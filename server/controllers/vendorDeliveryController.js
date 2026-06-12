'use strict';
const { VendorDelivery, VendorDeliveryItem, Vendor, User, Product, ProductSKU, ProductVariantOption, ProductVariantType } = require('../models');
const { destroyByUrl } = require('../helpers/cloudinary');
const { companyFilter, companyId: getCompanyId } = require('../helpers/tenancy');

const SKU_INCLUDE = {
  model: ProductSKU, as: 'ProductSKU', attributes: ['id', 'sku_code'],
  include: [{
    model: ProductVariantOption,
    attributes: ['value'],
    through: { attributes: [] },
    include: [{ model: ProductVariantType, attributes: ['name'] }],
  }],
};

const HEADER_INCLUDE = [
  { model: Vendor, as: 'Vendor',   attributes: ['id', 'name'] },
  { model: User,   as: 'Creator',  attributes: ['id', 'name'] },
];

const ITEM_INCLUDE = [
  { model: Product, as: 'Product', attributes: ['id', 'name', 'unit'] },
  SKU_INCLUDE,
];

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await VendorDelivery.findAndCountAll({
      where: companyFilter(req),
      include: [
        ...HEADER_INCLUDE,
        { model: VendorDeliveryItem, as: 'items', attributes: ['id'] },
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
    });
    const data = rows.map(r => ({ ...r.toJSON(), itemCount: r.items?.length ?? 0, items: undefined }));
    res.json({ data, pagination: { total: count, page: Number(page), limit: Number(limit), totalPages: Math.ceil(count / Number(limit)) } });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await VendorDelivery.findOne({
      where: { id: req.params.id, ...companyFilter(req) },
      include: [
        ...HEADER_INCLUDE,
        { model: VendorDeliveryItem, as: 'items', include: ITEM_INCLUDE },
      ],
    });
    if (!row) return res.status(404).json({ message: 'Barang masuk tidak ditemukan' });
    const data = {
      ...row.toJSON(),
      items: row.items.map(i => ({ ...i.toJSON(), selisih: (i.qtySJ ?? 0) - (i.qtyActual ?? 0) })),
    };
    res.json({ data });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { vendorId, date, sjNumber, videoLink, notes } = req.body;
    const newPhotos = (req.files ?? []).map(f => f.path);
    if (!vendorId) return res.status(400).json({ message: 'Vendor wajib dipilih' });
    if (!date)     return res.status(400).json({ message: 'Tanggal wajib diisi' });
    const row = await VendorDelivery.create({
      vendorId,
      date,
      sjNumber:  sjNumber?.trim()  || null,
      sjPhotos:  newPhotos.length > 0 ? newPhotos : null,
      videoLink: videoLink?.trim() || null,
      notes:     notes?.trim()     || null,
      createdBy: req.user.id,
      companyId: getCompanyId(req),
    });
    const result = await VendorDelivery.findByPk(row.id, { include: HEADER_INCLUDE });
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const row = await VendorDelivery.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!row) return res.status(404).json({ message: 'Barang masuk tidak ditemukan' });
    const { vendorId, date, sjNumber, videoLink, notes, keepPhotos } = req.body;
    const newPhotos  = (req.files ?? []).map(f => f.path);
    // Jika keepPhotos tidak dikirim sama sekali, pertahankan foto yang ada
    const kept       = keepPhotos !== undefined ? JSON.parse(keepPhotos) : (row.sjPhotos ?? []);
    const current    = row.sjPhotos ?? [];
    const removed    = current.filter(url => !kept.includes(url));
    for (const url of removed) await destroyByUrl(url).catch(() => {});
    const sjPhotos   = [...kept, ...newPhotos];
    await row.update({
      vendorId:  vendorId  ?? row.vendorId,
      date:      date      ?? row.date,
      sjNumber:  sjNumber  !== undefined ? (sjNumber?.trim()  || null) : row.sjNumber,
      sjPhotos:  sjPhotos.length > 0 ? sjPhotos : null,
      videoLink: videoLink !== undefined ? (videoLink?.trim() || null) : row.videoLink,
      notes:     notes     !== undefined ? (notes?.trim()     || null) : row.notes,
    });
    const result = await VendorDelivery.findByPk(row.id, { include: HEADER_INCLUDE });
    res.json({ data: result });
  } catch (err) { next(err); }
};

exports.destroy = async (req, res, next) => {
  try {
    const row = await VendorDelivery.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!row) return res.status(404).json({ message: 'Barang masuk tidak ditemukan' });
    for (const url of row.sjPhotos ?? []) await destroyByUrl(url).catch(() => {});
    await row.destroy();
    res.json({ message: 'Barang masuk dihapus' });
  } catch (err) { next(err); }
};

// ── Items ─────────────────────────────────────────────────────────────────────

exports.addItem = async (req, res, next) => {
  try {
    const delivery = await VendorDelivery.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!delivery) return res.status(404).json({ message: 'Barang masuk tidak ditemukan' });
    const { productId, productSkuId, qtySJ, qtyActual, notes } = req.body;
    if (!productId) return res.status(400).json({ message: 'Produk wajib dipilih' });
    const item = await VendorDeliveryItem.create({
      deliveryId:   delivery.id,
      productId,
      productSkuId: productSkuId || null,
      qtySJ:        Number(qtySJ)     || 0,
      qtyActual:    Number(qtyActual) || 0,
      notes:        notes?.trim() || null,
    });
    const result = await VendorDeliveryItem.findByPk(item.id, { include: ITEM_INCLUDE });
    res.status(201).json({ data: { ...result.toJSON(), selisih: result.qtySJ - result.qtyActual } });
  } catch (err) { next(err); }
};

exports.updateItem = async (req, res, next) => {
  try {
    const item = await VendorDeliveryItem.findOne({ where: { id: req.params.itemId, deliveryId: req.params.id } });
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan' });
    const { productId, productSkuId, qtySJ, qtyActual, notes } = req.body;
    await item.update({
      productId:    productId    ?? item.productId,
      productSkuId: productSkuId !== undefined ? (productSkuId || null) : item.productSkuId,
      qtySJ:        qtySJ     !== undefined ? Number(qtySJ)     : item.qtySJ,
      qtyActual:    qtyActual !== undefined ? Number(qtyActual) : item.qtyActual,
      notes:        notes     !== undefined ? (notes?.trim() || null) : item.notes,
    });
    const result = await VendorDeliveryItem.findByPk(item.id, { include: ITEM_INCLUDE });
    res.json({ data: { ...result.toJSON(), selisih: result.qtySJ - result.qtyActual } });
  } catch (err) { next(err); }
};

exports.removeItem = async (req, res, next) => {
  try {
    const item = await VendorDeliveryItem.findOne({ where: { id: req.params.itemId, deliveryId: req.params.id } });
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan' });
    await item.destroy();
    res.json({ message: 'Item dihapus' });
  } catch (err) { next(err); }
};
