'use strict';
const { VendorDelivery, VendorDeliveryItem, VendorDeliveryLog, Vendor, User, Product, ProductSKU, ProductVariantOption, ProductVariantType, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { destroyByUrl } = require('../helpers/cloudinary');
const { companyFilter, companyId: getCompanyId } = require('../helpers/tenancy');
const { paginate, paginatedResponse } = require('../helpers/queryHelper');

// Catat setiap aksi yang mengubah dokumen, agar semua orang yang pernah
// mengerjakan transaksi ini tercatat (tidak cuma pembuat & pengubah terakhir).
async function logActivity(deliveryId, userId, action, description) {
  await VendorDeliveryLog.create({ deliveryId, userId, action, description }).catch(() => {});
}

const LOG_INCLUDE = {
  model: VendorDeliveryLog, as: 'logs',
  include: [{ model: User, as: 'User', attributes: ['id', 'name'] }],
  separate: true,
  order: [['createdAt', 'DESC']],
};

// Recompute selisihStatus on parent delivery after any item mutation.
// Rule: no selisih left → null; has selisih + status was null → 'unclear';
//       has selisih + already 'clear'/'unclear' → keep (manual status).
// Exception: if a NEW selisih appears after being 'clear', keep 'clear' — team already reviewed.
async function syncSelisihStatus(deliveryId) {
  const items = await VendorDeliveryItem.findAll({
    where: { deliveryId },
    attributes: ['qtySJ', 'qtyActual'],
  });
  const hasSelisih = items.some(i => (i.qtySJ ?? 0) !== (i.qtyActual ?? 0));
  const delivery = await VendorDelivery.findByPk(deliveryId, { attributes: ['id', 'selisihStatus'] });
  if (!delivery) return;
  if (!hasSelisih) {
    await delivery.update({ selisihStatus: null });
  } else if (!delivery.selisihStatus) {
    await delivery.update({ selisihStatus: 'unclear' });
  }
}

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
  { model: User,   as: 'Updater',  attributes: ['id', 'name'] },
];

const ITEM_INCLUDE = [
  { model: Product, as: 'Product', attributes: ['id', 'name', 'unit'] },
  SKU_INCLUDE,
];

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, sjMissing, selisihFilter, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    // "Belum ada SJ" = nomor SJ kosong DAN foto SJ kosong (null / [] / '')
    const SJ_MISSING_SQL = literal(
      `(("sjNumber" IS NULL OR "sjNumber" = '') AND ("sjPhotos" IS NULL OR "sjPhotos"::text IN ('[]', 'null', '""')))`
    );
    const where = { ...companyFilter(req) };
    if (sjMissing === 'true') where[Op.and] = [SJ_MISSING_SQL];
    if (selisihFilter === 'unclear') where.selisihStatus = 'unclear';
    if (status) where.status = status;
    const { rows, count } = await VendorDelivery.findAndCountAll({
      where,
      distinct: true,
      include: [
        ...HEADER_INCLUDE,
        { model: VendorDeliveryItem, as: 'items', attributes: ['id', 'qtySJ', 'qtyActual'] },
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
    });
    const data = rows.map(r => {
      const items = r.items ?? [];
      const selisihCount = items.filter(i => (i.qtySJ ?? 0) !== (i.qtyActual ?? 0)).length;
      return { ...r.toJSON(), itemCount: items.length, selisihCount, items: undefined };
    });

    // Counter global untuk badge warning — seluruh data perusahaan, bukan cuma halaman ini
    const [sjMissingCount, selisihUnclearCount] = await Promise.all([
      VendorDelivery.count({ where: { ...companyFilter(req), [Op.and]: [SJ_MISSING_SQL] } }),
      VendorDelivery.count({ where: { ...companyFilter(req), selisihStatus: 'unclear' } }),
    ]);

    res.json({
      data,
      counts: { sjMissing: sjMissingCount, selisihUnclear: selisihUnclearCount },
      pagination: { total: count, page: Number(page), limit: Number(limit), totalPages: Math.ceil(count / Number(limit)) },
    });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await VendorDelivery.findOne({
      where: { id: req.params.id, ...companyFilter(req) },
      include: [
        ...HEADER_INCLUDE,
        { model: VendorDeliveryItem, as: 'items', include: ITEM_INCLUDE },
        LOG_INCLUDE,
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
      status:    'draft',
      createdBy: req.user.id,
      companyId: getCompanyId(req),
    });
    await logActivity(row.id, req.user.id, 'CREATE', 'Membuat dokumen barang masuk');
    const result = await VendorDelivery.findByPk(row.id, { include: HEADER_INCLUDE });
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const row = await VendorDelivery.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!row) return res.status(404).json({ message: 'Barang masuk tidak ditemukan' });
    const isClosed = row.status === 'closed';
    const { vendorId, date, sjNumber, videoLink, notes, keepPhotos } = req.body;
    const newPhotos = (req.files ?? []).map(f => f.path);
    const kept      = keepPhotos !== undefined ? JSON.parse(keepPhotos) : (row.sjPhotos ?? []);
    const current   = row.sjPhotos ?? [];
    const removed   = current.filter(url => !kept.includes(url));
    for (const url of removed) await destroyByUrl(url).catch(() => {});
    const sjPhotos  = [...kept, ...newPhotos];
    await row.update({
      // When closed: only SJ fields can change
      vendorId:  isClosed ? row.vendorId : (vendorId ?? row.vendorId),
      date:      isClosed ? row.date     : (date     ?? row.date),
      notes:     isClosed ? row.notes    : (notes !== undefined ? (notes?.trim() || null) : row.notes),
      // SJ fields always editable
      sjNumber:  sjNumber  !== undefined ? (sjNumber?.trim()  || null) : row.sjNumber,
      sjPhotos:  sjPhotos.length > 0 ? sjPhotos : null,
      videoLink: videoLink !== undefined ? (videoLink?.trim() || null) : row.videoLink,
      updatedBy: req.user.id,
    });
    await logActivity(row.id, req.user.id, 'UPDATE_HEADER', 'Mengubah data barang masuk');
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
    if (delivery.status === 'closed') return res.status(403).json({ message: 'Barang masuk sudah ditutup. Buka kembali untuk menambah item.' });
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
    await delivery.update({ updatedBy: req.user.id });
    await logActivity(delivery.id, req.user.id, 'ADD_ITEM', 'Menambah item');
    await syncSelisihStatus(delivery.id);
    const result = await VendorDeliveryItem.findByPk(item.id, { include: ITEM_INCLUDE });
    res.status(201).json({ data: { ...result.toJSON(), selisih: result.qtySJ - result.qtyActual } });
  } catch (err) { next(err); }
};

exports.updateItem = async (req, res, next) => {
  try {
    const item = await VendorDeliveryItem.findOne({ where: { id: req.params.itemId, deliveryId: req.params.id } });
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan' });
    const delivery = await VendorDelivery.findByPk(item.deliveryId, { attributes: ['id', 'status'] });
    if (delivery?.status === 'closed') return res.status(403).json({ message: 'Barang masuk sudah ditutup. Buka kembali untuk mengedit item.' });
    const { productId, productSkuId, qtySJ, qtyActual, notes } = req.body;
    await item.update({
      productId:    productId    ?? item.productId,
      productSkuId: productSkuId !== undefined ? (productSkuId || null) : item.productSkuId,
      qtySJ:        qtySJ     !== undefined ? Number(qtySJ)     : item.qtySJ,
      qtyActual:    qtyActual !== undefined ? Number(qtyActual) : item.qtyActual,
      notes:        notes     !== undefined ? (notes?.trim() || null) : item.notes,
    });
    await delivery?.update({ updatedBy: req.user.id });
    await logActivity(item.deliveryId, req.user.id, 'UPDATE_ITEM', 'Mengubah item');
    await syncSelisihStatus(item.deliveryId);
    const result = await VendorDeliveryItem.findByPk(item.id, { include: ITEM_INCLUDE });
    res.json({ data: { ...result.toJSON(), selisih: result.qtySJ - result.qtyActual } });
  } catch (err) { next(err); }
};

exports.removeItem = async (req, res, next) => {
  try {
    const item = await VendorDeliveryItem.findOne({ where: { id: req.params.itemId, deliveryId: req.params.id } });
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan' });
    const delivery = await VendorDelivery.findByPk(item.deliveryId, { attributes: ['id', 'status'] });
    if (delivery?.status === 'closed') return res.status(403).json({ message: 'Barang masuk sudah ditutup. Buka kembali untuk menghapus item.' });
    const deliveryId = item.deliveryId;
    await item.destroy();
    await delivery?.update({ updatedBy: req.user.id });
    await logActivity(deliveryId, req.user.id, 'REMOVE_ITEM', 'Menghapus item');
    await syncSelisihStatus(deliveryId);
    res.json({ message: 'Item dihapus' });
  } catch (err) { next(err); }
};

exports.patchSelisihStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['unclear', 'clear'].includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid. Gunakan: unclear atau clear' });
    }
    const row = await VendorDelivery.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!row) return res.status(404).json({ message: 'Barang masuk tidak ditemukan' });
    await row.update({ selisihStatus: status, updatedBy: req.user.id });
    await logActivity(
      row.id, req.user.id,
      status === 'clear' ? 'SELISIH_CLEAR' : 'SELISIH_REOPEN',
      status === 'clear' ? 'Menandai selisih selesai' : 'Membuka kembali selisih'
    );
    res.json({ data: { selisihStatus: status } });
  } catch (err) { next(err); }
};

exports.patchStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['draft', 'open', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid. Gunakan: draft, open, atau closed' });
    }
    const row = await VendorDelivery.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!row) return res.status(404).json({ message: 'Barang masuk tidak ditemukan' });

    const VALID_TRANSITIONS = {
      draft:  ['open', 'closed'],
      open:   ['closed', 'draft'],
      closed: ['open'],
    };
    if (!VALID_TRANSITIONS[row.status]?.includes(status)) {
      return res.status(400).json({ message: `Tidak bisa ubah status dari ${row.status} ke ${status}` });
    }

    const prevStatus = row.status;
    await row.update({ status, updatedBy: req.user.id });
    await logActivity(row.id, req.user.id, 'STATUS_CHANGE', `Mengubah status dari ${prevStatus} ke ${status}`);
    res.json({ data: { status } });
  } catch (err) { next(err); }
};

// Breakdown stok per vendor+produk: total pernah diterima (dari VendorDelivery)
// vs sekarang tersebar di gudang mana saja (dari Stock In/Out yang ditandai VendorId).
exports.stockBreakdown = async (req, res, next) => {
  try {
    const { vendorId, productId, dateFrom, dateTo } = req.query;
    if (!vendorId) return res.status(400).json({ message: 'vendorId wajib diisi' });
    const cf = companyFilter(req);

    const receivedConditions = ['vd."vendorId" = :vendorId'];
    const replacements = { vendorId };
    if (cf.companyId) { receivedConditions.push('vd."companyId" = :companyId'); replacements.companyId = cf.companyId; }
    if (productId)    { receivedConditions.push('vdi."productId" = :productId'); replacements.productId = productId; }
    if (dateFrom)     { receivedConditions.push('vd.date >= :dateFrom'); replacements.dateFrom = dateFrom; }
    if (dateTo)       { receivedConditions.push('vd.date <= :dateTo');   replacements.dateTo   = dateTo; }

    const received = await sequelize.query(`
      SELECT
        p.id                                     AS "productId",
        p.name                                   AS "productName",
        COALESCE(SUM(vdi."qtyActual"), 0)::int    AS "totalReceived"
      FROM "VendorDeliveries" vd
      JOIN "VendorDeliveryItems" vdi ON vdi."deliveryId" = vd.id
      JOIN "Products" p              ON p.id = vdi."productId"
      WHERE ${receivedConditions.join(' AND ')}
      GROUP BY p.id, p.name
      ORDER BY p.name ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const breakdownConditions = ['COALESCE(sih."VendorId", soh."VendorId") = :vendorId'];
    if (cf.companyId) breakdownConditions.push('sm."companyId" = :companyId');
    if (productId)    breakdownConditions.push('p.id = :productId');
    if (dateFrom)     breakdownConditions.push('sm.date >= :dateFrom');
    if (dateTo)       breakdownConditions.push('sm.date <= :dateTo');

    const breakdown = await sequelize.query(`
      SELECT
        wh.id                                                            AS "warehouseId",
        wh.name                                                          AS "warehouseName",
        p.id                                                             AS "productId",
        p.name                                                           AS "productName",
        SUM(CASE WHEN sm.type = 'IN' THEN sm.quantity ELSE -sm.quantity END)::int AS "netQty"
      FROM "Stock_Movements" sm
      JOIN "Warehouses" wh ON wh.id = sm."WarehouseId"
      JOIN "Products" p    ON p.id = sm."ProductId"
      LEFT JOIN "Stock_In_Headers"  sih ON sm.source = 'STOCK_IN'  AND sm."ReferenceId" = sih.id
      LEFT JOIN "Stock_Out_Headers" soh ON sm.source = 'STOCK_OUT' AND sm."ReferenceId" = soh.id
      WHERE ${breakdownConditions.join(' AND ')}
      GROUP BY wh.id, wh.name, p.id, p.name
      ORDER BY p.name ASC, wh.name ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    res.json({ received, breakdown });
  } catch (err) { next(err); }
};

exports.analytics = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, articleId, productId, productSkuId } = req.query;
    const cf = companyFilter(req);

    // Build WHERE clauses for the raw query
    const conditions = ['1=1'];
    const replacements = {};

    if (cf.companyId) {
      conditions.push('vd."companyId" = :companyId');
      replacements.companyId = cf.companyId;
    }
    if (dateFrom) { conditions.push('vd.date >= :dateFrom'); replacements.dateFrom = dateFrom; }
    if (dateTo)   { conditions.push('vd.date <= :dateTo');   replacements.dateTo   = dateTo;   }
    if (productId)    { conditions.push('vdi."productId" = :productId');       replacements.productId    = productId;    }
    if (productSkuId) { conditions.push('vdi."productSkuId" = :productSkuId'); replacements.productSkuId = productSkuId; }
    if (articleId)    { conditions.push('p."ArticleId" = :articleId');         replacements.articleId    = articleId;    }

    const where = conditions.join(' AND ');

    const chart = await sequelize.query(`
      SELECT
        vd.date::text                          AS date,
        COALESCE(SUM(vdi."qtyActual"), 0)::int AS qty,
        COUNT(DISTINCT vd.id)::int             AS deliveries
      FROM "VendorDeliveries" vd
      JOIN "VendorDeliveryItems" vdi ON vdi."deliveryId" = vd.id
      JOIN "Products" p              ON p.id = vdi."productId"
      WHERE ${where}
      GROUP BY vd.date
      ORDER BY vd.date ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    // Top products (limit 10)
    const topProducts = await sequelize.query(`
      SELECT
        p.id,
        p.name,
        COALESCE(SUM(vdi."qtyActual"), 0)::int AS qty
      FROM "VendorDeliveries" vd
      JOIN "VendorDeliveryItems" vdi ON vdi."deliveryId" = vd.id
      JOIN "Products" p              ON p.id = vdi."productId"
      WHERE ${where}
      GROUP BY p.id, p.name
      ORDER BY qty DESC
      LIMIT 10
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const totalQty       = chart.reduce((s, r) => s + r.qty, 0);
    const totalDeliveries = chart.reduce((s, r) => s + r.deliveries, 0);

    res.json({ chart, topProducts, summary: { totalQty, totalDeliveries } });
  } catch (err) { next(err); }
};

// Drill-down: daftar transaksi barang masuk untuk satu produk (tanggal, vendor, qty),
// dipakai saat user klik produk di panel Analitik.
//
// Dua tahap (bukan satu findAndCountAll dengan include berlapis) karena
// subquery-pagination Sequelize salah membangun JOIN saat include utama punya
// `where` sendiri + ada include lain yang many-to-many (ProductVariantOptions) —
// kolom FK yang dibutuhkan JOIN ikut terbuang di subquery-nya.
exports.productTransactions = async (req, res, next) => {
  try {
    const { productId, productSkuId, dateFrom, dateTo, articleId } = req.query;
    if (!productId) return res.status(400).json({ message: 'productId wajib diisi' });
    const cf = companyFilter(req);
    const { page, limit, offset } = paginate(req.query);

    const deliveryWhere = { ...cf };
    if (dateFrom || dateTo) {
      deliveryWhere.date = {};
      if (dateFrom) deliveryWhere.date[Op.gte] = dateFrom;
      if (dateTo)   deliveryWhere.date[Op.lte] = dateTo;
    }

    const itemWhere = { productId };
    if (productSkuId) itemWhere.productSkuId = productSkuId;

    const idFilterInclude = [
      { model: VendorDelivery, attributes: [], where: deliveryWhere },
      ...(articleId ? [{ model: Product, as: 'Product', attributes: [], where: { ArticleId: articleId } }] : []),
    ];

    const count = await VendorDeliveryItem.count({ where: itemWhere, include: idFilterInclude, distinct: true });

    const idRows = await VendorDeliveryItem.findAll({
      where: itemWhere,
      include: idFilterInclude,
      attributes: ['id'],
      order: [[VendorDelivery, 'date', 'DESC'], [VendorDelivery, 'id', 'DESC']],
      limit,
      offset,
      subQuery: false,
    });
    const ids = idRows.map(r => r.id);

    const rows = ids.length ? await VendorDeliveryItem.findAll({
      where: { id: ids },
      include: [
        {
          model: VendorDelivery,
          attributes: ['id', 'date', 'sjNumber'],
          include: [{ model: Vendor, as: 'Vendor', attributes: ['id', 'name'] }],
        },
        { model: Product, as: 'Product', attributes: ['id', 'name'] },
        SKU_INCLUDE,
      ],
      order: [[VendorDelivery, 'date', 'DESC'], [VendorDelivery, 'id', 'DESC']],
    }) : [];

    const data = rows.map(r => ({
      deliveryId:   r.VendorDelivery.id,
      date:         r.VendorDelivery.date,
      sjNumber:     r.VendorDelivery.sjNumber,
      vendorName:   r.VendorDelivery.Vendor?.name ?? null,
      productName:  r.Product?.name ?? null,
      skuCode:      r.ProductSKU?.sku_code ?? null,
      variant:      (r.ProductSKU?.ProductVariantOptions ?? []).map(o => o.value).join(' / ') || null,
      qtySJ:        r.qtySJ,
      qtyActual:    r.qtyActual,
    }));

    res.json(paginatedResponse(data, count, page, limit));
  } catch (err) { next(err); }
};
