'use strict';
const { Op } = require('sequelize');
const {
  sequelize, ManualShipment, ManualShipmentItem,
  ShipmentCategory, Product, ProductSKU,
  ProductVariantOption, ProductVariantType, User,
} = require('../models');
const { companyFilter, companyId: getCompanyId } = require('../helpers/tenancy');

// ── Preset ekspedisi ─────────────────────────────────────────────────────────
const EXPEDITION_PRESETS = [
  'JNE', 'J&T Express', 'SiCepat', 'AnterAja', 'Ninja Express',
  'Lion Parcel', 'Gosend', 'Grab Express', 'IDExpress', 'RPX',
];

// ── Include helpers ───────────────────────────────────────────────────────────
const ITEM_INCLUDE = {
  model: ManualShipmentItem,
  as: 'items',
  include: [
    { model: Product,    as: 'product', attributes: ['id', 'name', 'imageUrl'], required: false },
    { model: ProductSKU, as: 'productSku', attributes: ['id', 'sku_code'],       required: false },
  ],
};

const HEADER_INCLUDE = [
  { model: ShipmentCategory, as: 'category',        attributes: ['id', 'name'] },
  { model: User,             as: 'creator',         attributes: ['id', 'name'] },
  { model: User,             as: 'updater',         attributes: ['id', 'name'] },
  { model: User,             as: 'submitter',       attributes: ['id', 'name'] },
  { model: User,             as: 'paymentVerifier', attributes: ['id', 'name'] },
];

// ── Invoice number generator ──────────────────────────────────────────────────
async function generateInvoiceNumber(companyId, t) {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `INV/${yyyymm}/`;

  // Search globally (no companyId filter) — invoiceNumber has a global unique constraint
  const last = await ManualShipment.findOne({
    where: { invoiceNumber: { [Op.like]: `${prefix}%` } },
    order: [['invoiceNumber', 'DESC']],
    lock: t.LOCK.UPDATE,
    transaction: t,
  });

  let seq = 1;
  if (last) {
    const parts = last.invoiceNumber.split('/');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// ── Build snapshot fields from product/sku ────────────────────────────────────
async function resolveItemSnapshot(itemInput) {
  const { productId, productSkuId, quantity, unitPrice } = itemInput;
  if (!productId)       throw { status: 400, message: 'productId wajib diisi di setiap item' };
  if (!quantity || quantity <= 0) throw { status: 400, message: 'Quantity harus > 0' };

  const product = await Product.findByPk(productId, {
    attributes: ['id', 'name', 'imageUrl'],
  });
  if (!product) throw { status: 404, message: `Produk ${productId} tidak ditemukan` };

  let variantName = null;
  let skuCode = null;

  if (productSkuId) {
    const skuRow = await ProductSKU.findByPk(productSkuId, {
      include: [{
        model: ProductVariantOption,
        attributes: ['value'],
        through: { attributes: [] },
        include: [{ model: ProductVariantType, attributes: ['name'] }],
      }],
    });
    if (!skuRow) throw { status: 404, message: `SKU ${productSkuId} tidak ditemukan` };
    skuCode = skuRow.sku_code;
    if (skuRow.ProductVariantOptions?.length) {
      variantName = skuRow.ProductVariantOptions.map(o => o.value).join(' / ');
    }
  }

  const price  = parseFloat(unitPrice) || 0;
  const qty    = parseInt(quantity, 10);
  const sub    = price * qty;

  return {
    productId,
    productSkuId:    productSkuId || null,
    productName:     product.name,
    variantName,
    productImageUrl: product.imageUrl || null,
    sku:             skuCode,
    quantity:        qty,
    unitPrice:       price,
    subtotal:        sub,
  };
}

// ── Recalculate totals from items ─────────────────────────────────────────────
function calcTotals(items, shippingCost) {
  const subtotal = items.reduce((s, i) => s + parseFloat(i.subtotal), 0);
  const cost = parseFloat(shippingCost) || 0;
  return { subtotal, total: subtotal + cost };
}

// ── LIST ──────────────────────────────────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, status, type, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where = { ...companyFilter(req) };
    if (status) where.status = status;
    if (type)   where.type   = type;
    if (search) {
      where[Op.or] = [
        { invoiceNumber: { [Op.iLike]: `%${search}%` } },
        { buyerName:     { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows, count } = await ManualShipment.findAndCountAll({
      where,
      include: [
        ...HEADER_INCLUDE,
        { model: ManualShipmentItem, as: 'items', attributes: ['id'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
      distinct: true,
    });

    const data = rows.map(r => ({ ...r.toJSON(), itemCount: r.items?.length ?? 0, items: undefined }));
    res.json({
      data,
      pagination: { total: count, page: Number(page), limit: Number(limit), totalPages: Math.ceil(count / Number(limit)) },
    });
  } catch (err) { next(err); }
};

// ── GET ONE ───────────────────────────────────────────────────────────────────
exports.get = async (req, res, next) => {
  try {
    const row = await ManualShipment.findOne({
      where: { id: req.params.id, ...companyFilter(req) },
      include: [...HEADER_INCLUDE, ITEM_INCLUDE],
    });
    if (!row) return res.status(404).json({ message: 'Shipping tidak ditemukan' });
    res.json({ data: row });
  } catch (err) { next(err); }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      type, shipmentCategoryId,
      buyerName, buyerAddress, buyerPhone, recipientInfo,
      shippingCost = 0, expeditionName, notes,
      items = [],
    } = req.body;

    if (!['sales', 'non_sales'].includes(type)) throw { status: 400, message: 'type harus sales atau non_sales' };
    if (type === 'sales' && !buyerName?.trim())  throw { status: 400, message: 'Nama pembeli wajib diisi untuk sales' };
    if (!items.length)                           throw { status: 400, message: 'Minimal satu item diperlukan' };

    const cid = getCompanyId(req);
    const invoiceNumber = await generateInvoiceNumber(cid, t);

    const snapshots = [];
    for (const item of items) {
      snapshots.push(await resolveItemSnapshot(item));
    }

    const { subtotal, total } = calcTotals(snapshots, shippingCost);

    const shipment = await ManualShipment.create({
      companyId: cid,
      invoiceNumber,
      type,
      shipmentCategoryId: type === 'non_sales' ? (shipmentCategoryId || null) : null,
      status: 'draft',
      buyerName:    type === 'sales' ? buyerName?.trim()    : null,
      buyerAddress: type === 'sales' ? buyerAddress?.trim() : null,
      buyerPhone:   type === 'sales' ? buyerPhone?.trim()   : null,
      recipientInfo: type === 'non_sales' ? recipientInfo?.trim() : null,
      shippingCost: parseFloat(shippingCost) || 0,
      subtotal,
      total,
      expeditionName: expeditionName?.trim() || null,
      notes: notes?.trim() || null,
      createdBy: req.user.id,
    }, { transaction: t });

    for (const snap of snapshots) {
      await ManualShipmentItem.create({ ...snap, shipmentId: shipment.id }, { transaction: t });
    }

    await t.commit();

    const result = await ManualShipment.findByPk(shipment.id, { include: [...HEADER_INCLUDE, ITEM_INCLUDE] });
    res.status(201).json({ data: result });
  } catch (err) {
    await t.rollback();
    err.status ? res.status(err.status).json({ message: err.message }) : next(err);
  }
};

// ── UPDATE (edit — only when in_progress) ────────────────────────────────────
exports.update = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const shipment = await ManualShipment.findOne({
      where: { id: req.params.id, ...companyFilter(req) },
      include: [{ model: ManualShipmentItem, as: 'items' }],
      transaction: t,
    });
    if (!shipment) { await t.rollback(); return res.status(404).json({ message: 'Shipping tidak ditemukan' }); }
    if (!['draft', 'pending'].includes(shipment.status)) {
      await t.rollback();
      return res.status(400).json({ message: 'Hanya bisa diedit saat status draft atau pending' });
    }

    const {
      buyerName, buyerAddress, buyerPhone, recipientInfo,
      shipmentCategoryId, shippingCost, expeditionName, notes, items,
    } = req.body;

    const updatePayload = {
      buyerName:    buyerName?.trim()    ?? shipment.buyerName,
      buyerAddress: buyerAddress?.trim() ?? shipment.buyerAddress,
      buyerPhone:   buyerPhone?.trim()   ?? shipment.buyerPhone,
      recipientInfo: recipientInfo?.trim() ?? shipment.recipientInfo,
      shipmentCategoryId: shipmentCategoryId ?? shipment.shipmentCategoryId,
      expeditionName: expeditionName?.trim() ?? shipment.expeditionName,
      notes: notes?.trim() ?? shipment.notes,
    };

    if (items !== undefined) {
      if (!items.length) { await t.rollback(); return res.status(400).json({ message: 'Minimal satu item diperlukan' }); }

      await ManualShipmentItem.destroy({ where: { shipmentId: shipment.id }, transaction: t });
      const snapshots = [];
      for (const item of items) {
        snapshots.push(await resolveItemSnapshot(item));
      }
      for (const snap of snapshots) {
        await ManualShipmentItem.create({ ...snap, shipmentId: shipment.id }, { transaction: t });
      }

      const cost = shippingCost !== undefined ? parseFloat(shippingCost) : parseFloat(shipment.shippingCost);
      const { subtotal, total } = calcTotals(snapshots, cost);
      updatePayload.shippingCost = cost;
      updatePayload.subtotal = subtotal;
      updatePayload.total = total;
      // Flag so the detail page can warn that this no longer necessarily matches
      // the items on the originating Request (they're never re-synced).
      if (shipment.sourceRequestId) updatePayload.itemsModifiedFromSource = true;
    } else if (shippingCost !== undefined) {
      const cost = parseFloat(shippingCost) || 0;
      const currentSubtotal = parseFloat(shipment.subtotal);
      updatePayload.shippingCost = cost;
      updatePayload.total = currentSubtotal + cost;
    }

    await shipment.update({ ...updatePayload, updatedBy: req.user.id }, { transaction: t });
    await t.commit();

    const result = await ManualShipment.findByPk(shipment.id, { include: [...HEADER_INCLUDE, ITEM_INCLUDE] });
    res.json({ data: result });
  } catch (err) {
    await t.rollback();
    err.status ? res.status(err.status).json({ message: err.message }) : next(err);
  }
};

// ── CHANGE STATUS ─────────────────────────────────────────────────────────────
exports.changeStatus = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    // Lock the row so two concurrent status changes (e.g. double-click, two admins)
    // can't both pass the transition check against the same stale `current` status.
    const shipment = await ManualShipment.findOne({
      where: { id: req.params.id, ...companyFilter(req) },
      transaction: t, lock: t.LOCK.UPDATE,
    });
    if (!shipment) { await t.rollback(); return res.status(404).json({ message: 'Shipping tidak ditemukan' }); }

    const { status, cancelledReason } = req.body;
    const current = shipment.status;

    const VALID_TRANSITIONS = {
      draft:     ['pending', 'cancelled'],
      pending:   shipment.type === 'sales' ? ['paid', 'cancelled'] : ['shipped', 'cancelled'],
      paid:      ['shipped', 'cancelled'],
      shipped:   ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    if (!VALID_TRANSITIONS[current]?.includes(status)) {
      await t.rollback();
      return res.status(400).json({ message: `Tidak bisa ubah status dari ${current} ke ${status}` });
    }

    if (status === 'paid') {
      if (shipment.type !== 'sales') { await t.rollback(); return res.status(400).json({ message: 'Status paid hanya untuk transaksi sales' }); }
      if (!shipment.paymentProofUrl) { await t.rollback(); return res.status(400).json({ message: 'Upload bukti transfer terlebih dahulu' }); }
      await shipment.update({
        status: 'paid',
        paymentProofVerifiedBy: req.user.id,
        paymentProofVerifiedAt: new Date(),
      }, { transaction: t });
    } else if (status === 'cancelled') {
      await shipment.update({ status: 'cancelled', cancelledReason: cancelledReason?.trim() || null, updatedBy: req.user.id }, { transaction: t });
    } else {
      const isFinalized = ['shipped', 'completed'].includes(status);
      await shipment.update({
        status,
        updatedBy: req.user.id,
        ...(isFinalized ? { submittedBy: req.user.id } : {}),
      }, { transaction: t });
    }

    // Sync status ke Request asal kalau ada link
    if (shipment.sourceRequestId) {
      const { Request } = require('../models');
      const linkedRequest = await Request.findByPk(shipment.sourceRequestId, { transaction: t });
      if (linkedRequest) {
        if (status === 'shipped')   await linkedRequest.update({ status: 'SENT', sentAt: new Date().toISOString().slice(0, 10), processedBy: req.user.id }, { transaction: t });
        if (status === 'completed') await linkedRequest.update({ status: 'DONE', processedBy: req.user.id }, { transaction: t });
        if (status === 'cancelled') await linkedRequest.update({ status: 'APPROVED', manualShipmentId: null }, { transaction: t });
      }
      if (status === 'cancelled') await shipment.update({ sourceRequestId: null }, { transaction: t });
    }

    await t.commit();

    const result = await ManualShipment.findByPk(shipment.id, { include: [...HEADER_INCLUDE, ITEM_INCLUDE] });
    res.json({ data: result });
  } catch (err) { await t.rollback(); next(err); }
};

// ── UPLOAD PAYMENT PROOF ──────────────────────────────────────────────────────
exports.uploadPaymentProof = async (req, res, next) => {
  try {
    const shipment = await ManualShipment.findOne({
      where: { id: req.params.id, ...companyFilter(req) },
    });
    if (!shipment) return res.status(404).json({ message: 'Shipping tidak ditemukan' });
    if (shipment.type !== 'sales') return res.status(400).json({ message: 'Bukti transfer hanya untuk transaksi sales' });
    if (!['pending', 'paid'].includes(shipment.status)) {
      return res.status(400).json({ message: 'Tidak bisa upload bukti di status ini' });
    }

    const fileUrl = req.file?.path || req.file?.secure_url || req.body.paymentProofUrl;
    if (!fileUrl) return res.status(400).json({ message: 'File bukti transfer wajib diupload' });

    await shipment.update({ paymentProofUrl: fileUrl });
    res.json({ data: { paymentProofUrl: fileUrl }, message: 'Bukti transfer berhasil diupload' });
  } catch (err) { next(err); }
};

// ── UPLOAD COURIER RESI ───────────────────────────────────────────────────────
exports.uploadCourierResi = async (req, res, next) => {
  try {
    const shipment = await ManualShipment.findOne({
      where: { id: req.params.id, ...companyFilter(req) },
    });
    if (!shipment) return res.status(404).json({ message: 'Shipping tidak ditemukan' });
    if (shipment.status === 'cancelled') return res.status(400).json({ message: 'Shipping sudah dibatalkan' });

    const { courierResiNumber } = req.body;
    const resiImageUrl = req.file?.path || req.file?.secure_url || req.body.courierResiImageUrl || null;

    if (!courierResiNumber?.trim() && !resiImageUrl) {
      return res.status(400).json({ message: 'Nomor resi atau foto resi wajib diisi' });
    }

    await shipment.update({
      courierResiNumber:   courierResiNumber?.trim() || shipment.courierResiNumber,
      courierResiImageUrl: resiImageUrl || shipment.courierResiImageUrl,
    });
    res.json({ data: shipment, message: 'Resi kurir berhasil disimpan' });
  } catch (err) { next(err); }
};

// ── MARK PRINTED ─────────────────────────────────────────────────────────────
exports.markPrinted = async (req, res, next) => {
  try {
    const shipment = await ManualShipment.findOne({
      where: { id: req.params.id, ...companyFilter(req) },
    });
    if (!shipment) return res.status(404).json({ message: 'Shipping tidak ditemukan' });

    const { type } = req.body; // 'resi' | 'invoice'
    const now = new Date();
    if (type === 'resi')    await shipment.update({ resiPrintedAt:    now });
    else if (type === 'invoice') await shipment.update({ invoicePrintedAt: now });
    else return res.status(400).json({ message: 'type harus resi atau invoice' });

    res.json({ data: { resiPrintedAt: shipment.resiPrintedAt, invoicePrintedAt: shipment.invoicePrintedAt } });
  } catch (err) { next(err); }
};

// ── DELETE ────────────────────────────────────────────────────────────────────
exports.destroy = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const shipment = await ManualShipment.findOne({
      where: { id: req.params.id, ...companyFilter(req) },
      transaction: t,
    });
    if (!shipment) { await t.rollback(); return res.status(404).json({ message: 'Shipping tidak ditemukan' }); }

    if (!['draft', 'pending', 'cancelled'].includes(shipment.status)) {
      await t.rollback();
      return res.status(400).json({ message: 'Hanya bisa dihapus saat status draft, pending, atau cancelled' });
    }

    // Unlink from source request so the request can create a new shipment
    if (shipment.sourceRequestId) {
      const { Request } = require('../models');
      await Request.update({ manualShipmentId: null }, { where: { id: shipment.sourceRequestId }, transaction: t });
    }

    await ManualShipmentItem.destroy({ where: { shipmentId: shipment.id }, transaction: t });
    await shipment.destroy({ transaction: t });
    await t.commit();
    res.json({ message: 'Shipping dihapus' });
  } catch (err) { await t.rollback(); next(err); }
};

// ── EXPEDITION PRESETS ────────────────────────────────────────────────────────
exports.expeditionPresets = (_req, res) => {
  res.json({ data: EXPEDITION_PRESETS });
};

// ── EXPORTED HELPER (used by requestController) ───────────────────────────────
exports.generateInvoiceNumber = generateInvoiceNumber;
