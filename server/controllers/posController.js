'use strict';
const {
    PosEvent, PosShift, PosOrder, PosOrderItem, PosPayment,
    Stock_Out_Header, Stock_Movement, Stock, SkuWarehouseStock,
    Product, ProductSKU, ProductVariantOption, Warehouse, Channel, User, Category, sequelize,
} = require('../models');
const { Op, UniqueConstraintError } = require('sequelize');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, paginatedResponse } = require('../helpers/queryHelper');
const { upsertSkuWarehouseStock } = require('../helpers/skuStock');

const PAY_METHODS   = ['CASH', 'QRIS', 'TRANSFER', 'EDC', 'OTHER'];
const EVENT_STATUS  = ['PREP', 'OPEN', 'CLOSED'];
const isInt = (v, min = 0) => Number.isInteger(v) && v >= min;
const bad = (res, message) => res.status(400).json({ message });

const ORDER_INCLUDE = [
    { model: PosOrderItem, as: 'items' },
    { model: PosPayment,   as: 'payments' },
    { model: User,         as: 'Cashier', attributes: ['id', 'name'] },
    { model: User,         as: 'PickedUpBy', attributes: ['id', 'name'] },
];

async function findEvent(req, id, t) {
    return PosEvent.findOne({ where: { id, ...companyFilter(req) }, transaction: t });
}

// Ringkasan pembayaran sebuah shift; dipakai saat tutup shift & di layar kasir.
async function shiftSummary(shift) {
    const orders = await PosOrder.findAll({
        where: { shiftId: shift.id, status: 'PAID' },
        include: [{ model: PosPayment, as: 'payments' }],
    });
    const byMethod = Object.fromEntries(PAY_METHODS.map(m => [m, 0]));
    let total = 0, discount = 0;
    for (const o of orders) {
        total += o.total;
        discount += o.itemDiscount + o.orderDiscount;
        for (const p of o.payments) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    }
    const expectedCash = shift.openingCash + byMethod.CASH;
    return {
        orderCount: orders.length, total, discount, byMethod, expectedCash,
        cashDifference: shift.countedCash == null ? null : shift.countedCash - expectedCash,
    };
}

class PosController {
    // ── Event ────────────────────────────────────────────────────────────────
    static async listEvents(req, res, next) {
        try {
            const rows = await PosEvent.findAll({
                where: companyFilter(req),
                include: [{ model: Warehouse, attributes: ['id', 'name'] }, { model: Channel, attributes: ['id', 'name'] }],
                order: [['createdAt', 'DESC']],
            });
            res.json(rows);
        } catch (err) { next(err); }
    }

    static async getEvent(req, res, next) {
        try {
            const ev = await PosEvent.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [{ model: Warehouse, attributes: ['id', 'name'] }, { model: Channel, attributes: ['id', 'name'] }],
            });
            if (!ev) throw { name: 'NotFound', message: 'Event tidak ditemukan' };
            res.json(ev);
        } catch (err) { next(err); }
    }

    static async createEvent(req, res, next) {
        try {
            const { name, location, startDate, endDate, WarehouseId, ChannelId, receiptHeader, receiptFooter } = req.body;
            if (!name || !WarehouseId || !ChannelId) return bad(res, 'Nama event, gudang, dan channel wajib diisi');
            const cid = companyId(req);
            const wh = await Warehouse.findOne({ where: { id: WarehouseId, ...(cid ? { companyId: cid } : {}) } });
            if (!wh) return bad(res, 'Gudang tidak ditemukan');
            const ch = await Channel.findOne({ where: { id: ChannelId, ...(cid ? { companyId: cid } : {}) } });
            if (!ch) return bad(res, 'Channel tidak ditemukan');
            const ev = await PosEvent.create({
                name, location, startDate, endDate, WarehouseId, ChannelId, receiptHeader, receiptFooter,
                status: 'PREP', createdBy: req.user.id, companyId: cid,
            });
            res.status(201).json(ev);
        } catch (err) { next(err); }
    }

    static async updateEvent(req, res, next) {
        try {
            const ev = await findEvent(req, req.params.id);
            if (!ev) throw { name: 'NotFound', message: 'Event tidak ditemukan' };
            const updates = {};
            for (const k of ['name', 'location', 'startDate', 'endDate', 'receiptHeader', 'receiptFooter']) {
                if (req.body[k] !== undefined) updates[k] = req.body[k];
            }
            if (req.body.status !== undefined) {
                if (!EVENT_STATUS.includes(req.body.status)) return bad(res, `status harus salah satu dari ${EVENT_STATUS.join(', ')}`);
                updates.status = req.body.status;
            }
            // gudang & channel dikunci begitu sudah ada transaksi, supaya laporan event tidak campur
            for (const k of ['WarehouseId', 'ChannelId']) {
                if (req.body[k] !== undefined && Number(req.body[k]) !== ev[k]) {
                    const used = await PosOrder.count({ where: { eventId: ev.id } });
                    if (used) return bad(res, 'Gudang/channel tidak bisa diganti setelah ada transaksi');
                    updates[k] = req.body[k];
                }
            }
            await ev.update(updates);
            res.json(ev);
        } catch (err) { next(err); }
    }

    // Katalog untuk disimpan di laptop kasir (mode offline): semua SKU + stok di gudang event.
    static async catalog(req, res, next) {
        try {
            const ev = await findEvent(req, req.params.id);
            if (!ev) throw { name: 'NotFound', message: 'Event tidak ditemukan' };
            const skus = await ProductSKU.findAll({
                where: { companyId: ev.companyId },
                attributes: ['id', 'sku_code', 'price', 'ProductId'],
                include: [
                    { model: Product, attributes: ['id', 'name', 'imageUrl'], include: [{ model: Category, attributes: ['id', 'name'] }] },
                    { model: ProductVariantOption, attributes: ['value'], through: { attributes: [] } },
                ],
                order: [['ProductId', 'ASC'], ['position', 'ASC']],
            });
            const stockRows = await SkuWarehouseStock.findAll({ where: { WarehouseId: ev.WarehouseId }, attributes: ['ProductSKUId', 'qty'] });
            const stock = Object.fromEntries(stockRows.map(s => [s.ProductSKUId, s.qty]));
            res.json({
                event: { id: ev.id, name: ev.name, location: ev.location, status: ev.status, WarehouseId: ev.WarehouseId, receiptHeader: ev.receiptHeader, receiptFooter: ev.receiptFooter },
                generatedAt: new Date().toISOString(),
                items: skus.filter(s => s.Product).map(s => ({
                    skuId: s.id,
                    code: s.sku_code,
                    productId: s.ProductId,
                    name: s.Product.name,
                    imageUrl: s.Product.imageUrl || null,
                    category: s.Product.Category?.name || null,
                    variant: (s.ProductVariantOptions || []).map(o => o.value).join(' / ') || null,
                    price: Math.round(Number(s.price) || 0),
                    stock: stock[s.id] ?? 0,
                })),
            });
        } catch (err) { next(err); }
    }

    // ── Shift ────────────────────────────────────────────────────────────────
    static async openShift(req, res, next) {
        try {
            const { eventId, deviceName, openingCash = 0 } = req.body;
            const ev = await findEvent(req, eventId);
            if (!ev) return bad(res, 'Event tidak ditemukan');
            if (ev.status !== 'OPEN') return bad(res, 'Event belum dibuka untuk penjualan');
            if (!isInt(Number(openingCash))) return bad(res, 'Modal awal kas tidak valid');
            const shift = await PosShift.create({
                eventId: ev.id, cashierId: req.user.id, deviceName: deviceName || null,
                openedAt: new Date(), openingCash: Number(openingCash), status: 'OPEN', companyId: ev.companyId,
            });
            res.status(201).json(shift);
        } catch (err) { next(err); }
    }

    static async getShift(req, res, next) {
        try {
            const shift = await PosShift.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [{ model: User, as: 'Cashier', attributes: ['id', 'name'] }],
            });
            if (!shift) throw { name: 'NotFound', message: 'Shift tidak ditemukan' };
            res.json({ ...shift.toJSON(), summary: await shiftSummary(shift) });
        } catch (err) { next(err); }
    }

    static async listShifts(req, res, next) {
        try {
            const where = { ...companyFilter(req) };
            if (req.query.eventId) where.eventId = req.query.eventId;
            const rows = await PosShift.findAll({
                where, include: [{ model: User, as: 'Cashier', attributes: ['id', 'name'] }], order: [['openedAt', 'DESC']],
            });
            res.json(await Promise.all(rows.map(async s => ({ ...s.toJSON(), summary: await shiftSummary(s) }))));
        } catch (err) { next(err); }
    }

    static async closeShift(req, res, next) {
        try {
            const shift = await PosShift.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!shift) throw { name: 'NotFound', message: 'Shift tidak ditemukan' };
            if (shift.status === 'CLOSED') return bad(res, 'Shift sudah ditutup');
            const counted = Number(req.body.countedCash);
            if (!isInt(counted)) return bad(res, 'Hitungan kas fisik wajib diisi');
            await shift.update({ countedCash: counted, note: req.body.note ?? shift.note, closedAt: new Date(), status: 'CLOSED' });
            res.json({ ...shift.toJSON(), summary: await shiftSummary(shift) });
        } catch (err) { next(err); }
    }

    // ── Order ────────────────────────────────────────────────────────────────
    // Idempoten per clientOrderId: transaksi offline yang dikirim ulang cukup dijawab "sudah ada".
    static async createOrder(req, res, next) {
        const b = req.body || {};
        if (!b.clientOrderId || !b.orderNumber) return bad(res, 'clientOrderId dan orderNumber wajib diisi');
        try {
            const ev = await findEvent(req, b.eventId);
            if (!ev) return bad(res, 'Event tidak ditemukan');
            const cid = ev.companyId;
            const existing = await PosOrder.findOne({ where: { companyId: cid, clientOrderId: b.clientOrderId }, include: ORDER_INCLUDE });
            if (existing) return res.status(200).json({ duplicate: true, order: existing });
            if (ev.status === 'PREP') return bad(res, 'Event belum dibuka untuk penjualan');
            if (b.shiftId) {
                const shift = await PosShift.findOne({ where: { id: b.shiftId, eventId: ev.id } });
                if (!shift) return bad(res, 'Shift tidak ditemukan di event ini');
            }

            const items = Array.isArray(b.items) ? b.items : [];
            if (!items.length) return bad(res, 'Keranjang kosong');
            const skuIds = [...new Set(items.map(i => Number(i.ProductSKUId)))];
            const skus = await ProductSKU.findAll({
                where: { id: skuIds, companyId: ev.companyId },
                include: [
                    { model: Product, attributes: ['id', 'name'] },
                    { model: ProductVariantOption, attributes: ['value'], through: { attributes: [] } },
                ],
            });
            const skuMap = Object.fromEntries(skus.map(s => [s.id, s]));

            let subtotal = 0, itemDiscount = 0;
            const lines = [];
            for (const i of items) {
                const sku = skuMap[Number(i.ProductSKUId)];
                const qty = Number(i.qty), unitPrice = Number(i.unitPrice), discount = Number(i.discount || 0);
                if (!sku) return bad(res, `SKU ${i.ProductSKUId} tidak ditemukan`);
                if (!isInt(qty, 1) || !isInt(unitPrice) || !isInt(discount) || discount > qty * unitPrice) {
                    return bad(res, `Qty/harga/diskon tidak valid untuk ${sku.sku_code}`);
                }
                subtotal += qty * unitPrice;
                itemDiscount += discount;
                lines.push({
                    sku, qty, unitPrice, discount, lineTotal: qty * unitPrice - discount,
                    name: sku.Product?.name || sku.sku_code,
                    variant: (sku.ProductVariantOptions || []).map(o => o.value).join(' / ') || null,
                    listPrice: Math.round(Number(sku.price) || 0),
                });
            }
            const orderDiscount = Number(b.orderDiscount || 0);
            if (!isInt(orderDiscount) || orderDiscount > subtotal - itemDiscount) return bad(res, 'Diskon transaksi tidak valid');
            const total = subtotal - itemDiscount - orderDiscount;

            const payments = Array.isArray(b.payments) ? b.payments : [];
            for (const p of payments) {
                if (!PAY_METHODS.includes(p.method) || !isInt(Number(p.amount), 1)) return bad(res, 'Pembayaran tidak valid');
            }
            const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
            if (paid !== total) return bad(res, `Jumlah pembayaran (${paid}) harus sama dengan total (${total})`);
            const cashPart = payments.filter(p => p.method === 'CASH').reduce((s, p) => s + Number(p.amount), 0);
            const cashReceived = b.cashReceived != null ? Number(b.cashReceived) : null;
            if (cashReceived != null && (!isInt(cashReceived) || cashReceived < cashPart)) return bad(res, 'Uang diterima kurang dari bagian cash');
            const fulfillment = b.fulfillment === 'LATER' ? 'LATER' : 'NOW';
            const soldAt = b.soldAt ? new Date(b.soldAt) : new Date();
            if (Number.isNaN(soldAt.getTime())) return bad(res, 'soldAt tidak valid');

            const review = [];
            if (ev.status === 'CLOSED') review.push('Transaksi masuk setelah event ditutup');

            const t = await sequelize.transaction();
            try {
                const header = await Stock_Out_Header.create({
                    WarehouseId: ev.WarehouseId, date: soldAt, purpose: 'Penjualan', ChannelId: ev.ChannelId,
                    notes: `POS ${b.orderNumber} - ${ev.name}`, status: 'closed', createdBy: req.user.id, companyId: ev.companyId,
                }, { transaction: t });

                for (const l of lines) {
                    const ProductSKUId = l.sku.id, ProductId = l.sku.ProductId, WarehouseId = ev.WarehouseId;
                    const skuStock = await SkuWarehouseStock.findOne({ where: { ProductSKUId, WarehouseId }, transaction: t, lock: t.LOCK.UPDATE });
                    const available = skuStock ? Number(skuStock.qty) : 0;
                    // beda dengan Stock Out biasa: stok kurang tidak menolak transaksi (barang fisik di tangan kasir yang benar)
                    if (available < l.qty) review.push(`Stok sistem ${l.sku.sku_code} kurang (tersedia ${available}, terjual ${l.qty})`);
                    await l.sku.decrement('qty', { by: l.qty, transaction: t });
                    await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, WarehouseId, delta: -l.qty, companyId: ev.companyId });
                    const [stock] = await Stock.findOrCreate({
                        where: { ProductId, WarehouseId }, defaults: { quantity: 0, companyId: ev.companyId }, transaction: t,
                    });
                    await stock.update({ quantity: Math.max(0, Number(stock.quantity) - l.qty) }, { transaction: t });
                    await Stock_Movement.create({
                        ProductId, ProductSKUId, WarehouseId, type: 'OUT', quantity: l.qty,
                        ReferenceId: header.id, source: 'STOCK_OUT', date: soldAt, companyId: ev.companyId,
                    }, { transaction: t });
                }

                const order = await PosOrder.create({
                    companyId: cid, eventId: ev.id, shiftId: b.shiftId || null, cashierId: req.user.id,
                    clientOrderId: b.clientOrderId, orderNumber: b.orderNumber, soldAt,
                    subtotal, itemDiscount, orderDiscount, total,
                    cashReceived, change: cashReceived != null ? cashReceived - cashPart : 0,
                    customerName: String(b.customerName || '').trim().slice(0, 100) || null,
                    fulfillment, pickupCode: String(b.pickupCode || '').slice(0, 20) || null,
                    pickupStatus: fulfillment === 'LATER' ? 'PENDING' : 'DONE',
                    pickedUpAt: fulfillment === 'LATER' ? null : soldAt,
                    customerPhone: String(b.customerPhone || '').replace(/[^\d+]/g, '').slice(0, 30) || null,
                    discountNote: b.discountNote || null, note: b.note || null, status: 'PAID',
                    needsReview: review.length > 0, reviewNote: review.join('; ') || null,
                    StockOutHeaderId: header.id,
                }, { transaction: t });
                await PosOrderItem.bulkCreate(lines.map(l => ({
                    orderId: order.id, ProductId: l.sku.ProductId, ProductSKUId: l.sku.id, name: l.name, variant: l.variant,
                    qty: l.qty, listPrice: l.listPrice, unitPrice: l.unitPrice, discount: l.discount, lineTotal: l.lineTotal,
                })), { transaction: t });
                await PosPayment.bulkCreate(payments.map(p => ({
                    orderId: order.id, method: p.method, amount: Number(p.amount), reference: p.reference || null,
                })), { transaction: t });
                await t.commit();
                const full = await PosOrder.findByPk(order.id, { include: ORDER_INCLUDE });
                res.status(201).json({ duplicate: false, order: full });
            } catch (err) {
                await t.rollback();
                // dua kiriman bersamaan untuk transaksi yang sama: yang kalah cukup ambil yang sudah tersimpan
                if (err instanceof UniqueConstraintError) {
                    const order = await PosOrder.findOne({ where: { companyId: cid, clientOrderId: b.clientOrderId }, include: ORDER_INCLUDE });
                    if (order) return res.status(200).json({ duplicate: true, order });
                }
                throw err;
            }
        } catch (err) { next(err); }
    }

    static async listOrders(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const where = { ...companyFilter(req) };
            for (const k of ['eventId', 'shiftId', 'status', 'fulfillment', 'pickupStatus']) if (req.query[k]) where[k] = req.query[k];
            if (req.query.needsReview === 'true') where.needsReview = true;
            // cari dari nomor struk / nomor ambil / nama / akhiran No. HP (mis. 4 digit terakhir)
            const q = String(req.query.search || '').trim();
            if (q) {
                const digits = q.replace(/\D/g, '');
                where[Op.or] = [
                    { orderNumber:  { [Op.iLike]: `%${q}%` } },
                    { pickupCode:   { [Op.iLike]: `%${q}%` } },
                    { customerName: { [Op.iLike]: `%${q}%` } },
                    ...(digits.length >= 3 ? [{ customerPhone: { [Op.like]: `%${digits}` } }] : []),
                ];
            }
            const { rows, count } = await PosOrder.findAndCountAll({
                where, include: [...ORDER_INCLUDE, { model: PosEvent, as: 'event', attributes: ['id', 'name'] }],
                // antrean pengambilan: yang paling lama menunggu di atas
                order: [['soldAt', req.query.pickupStatus === 'PENDING' ? 'ASC' : 'DESC']],
                limit, offset, distinct: true,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getOrder(req, res, next) {
        try {
            const order = await PosOrder.findOne({ where: { id: req.params.id, ...companyFilter(req) }, include: ORDER_INCLUDE });
            if (!order) throw { name: 'NotFound', message: 'Transaksi tidak ditemukan' };
            res.json(order);
        } catch (err) { next(err); }
    }

    // Tandai barang "ambil nanti" sudah / belum diambil pelanggan.
    static async setPickup(req, res, next) {
        try {
            const order = await PosOrder.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!order) throw { name: 'NotFound', message: 'Transaksi tidak ditemukan' };
            if (order.status === 'VOID') return bad(res, 'Transaksi sudah dibatalkan');
            if (order.fulfillment !== 'LATER') return bad(res, 'Transaksi ini barangnya sudah dibawa langsung');
            const done = req.body?.status === 'DONE';
            if (!done && req.body?.status !== 'PENDING') return bad(res, "status harus 'DONE' atau 'PENDING'");
            await order.update({ pickupStatus: done ? 'DONE' : 'PENDING', pickedUpAt: done ? new Date() : null, pickedUpBy: done ? req.user.id : null });
            res.json(await PosOrder.findByPk(order.id, { include: ORDER_INCLUDE }));
        } catch (err) { next(err); }
    }

    // Void: kembalikan stok & hapus Stock Out-nya; transaksi kasir tetap disimpan dengan status VOID.
    static async voidOrder(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const order = await PosOrder.findOne({ where: { id: req.params.id, ...companyFilter(req) }, transaction: t, lock: t.LOCK.UPDATE });
            if (!order) { await t.rollback(); throw { name: 'NotFound', message: 'Transaksi tidak ditemukan' }; }
            if (order.status === 'VOID') { await t.rollback(); return bad(res, 'Transaksi sudah dibatalkan'); }
            if (!req.body?.reason) { await t.rollback(); return bad(res, 'Alasan pembatalan wajib diisi'); }

            if (order.StockOutHeaderId) {
                const movements = await Stock_Movement.findAll({
                    where: { ReferenceId: order.StockOutHeaderId, source: 'STOCK_OUT', type: 'OUT' }, transaction: t,
                });
                for (const mv of movements) {
                    const stock = await Stock.findOne({ where: { ProductId: mv.ProductId, WarehouseId: mv.WarehouseId }, transaction: t });
                    if (stock) await stock.increment('quantity', { by: mv.quantity, transaction: t });
                    if (mv.ProductSKUId) {
                        await ProductSKU.increment('qty', { by: mv.quantity, where: { id: mv.ProductSKUId }, transaction: t });
                        await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: mv.ProductSKUId, WarehouseId: mv.WarehouseId, delta: mv.quantity, companyId: mv.companyId });
                    }
                }
                await Stock_Movement.destroy({ where: { ReferenceId: order.StockOutHeaderId, source: 'STOCK_OUT' }, transaction: t });
                await Stock_Out_Header.destroy({ where: { id: order.StockOutHeaderId }, transaction: t });
            }
            await order.update({
                status: 'VOID', voidedAt: new Date(), voidedBy: req.user.id, voidReason: req.body.reason, StockOutHeaderId: null,
            }, { transaction: t });
            await t.commit();
            res.json(await PosOrder.findByPk(order.id, { include: ORDER_INCLUDE }));
        } catch (err) { if (!t.finished) await t.rollback(); next(err); }
    }

    // ── Laporan event ────────────────────────────────────────────────────────
    static async report(req, res, next) {
        try {
            const ev = await findEvent(req, req.params.id);
            if (!ev) throw { name: 'NotFound', message: 'Event tidak ditemukan' };
            const orders = await PosOrder.findAll({ where: { eventId: ev.id }, include: ORDER_INCLUDE, order: [['soldAt', 'ASC']] });
            const paid = orders.filter(o => o.status === 'PAID');
            const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

            const byMethod = Object.fromEntries(PAY_METHODS.map(m => [m, 0]));
            const byDay = {}, byProduct = {};
            for (const o of paid) {
                for (const p of o.payments) byMethod[p.method] += p.amount;
                // tanggal lokal WIB supaya transaksi malam tidak pindah hari
                const day = new Date(new Date(o.soldAt).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
                byDay[day] = byDay[day] || { day, orders: 0, qty: 0, total: 0 };
                byDay[day].orders += 1; byDay[day].total += o.total;
                for (const i of o.items) {
                    byDay[day].qty += i.qty;
                    const k = i.ProductSKUId || i.name;
                    byProduct[k] = byProduct[k] || { ProductSKUId: i.ProductSKUId, name: i.name, variant: i.variant, qty: 0, gross: 0, discount: 0, net: 0 };
                    const bp = byProduct[k];
                    bp.qty += i.qty; bp.gross += i.qty * i.unitPrice; bp.discount += i.discount; bp.net += i.lineTotal;
                }
            }
            const shifts = await PosShift.findAll({ where: { eventId: ev.id }, include: [{ model: User, as: 'Cashier', attributes: ['id', 'name'] }], order: [['openedAt', 'ASC']] });
            res.json({
                event: ev,
                totals: {
                    orders: paid.length,
                    qty: sum(paid, o => sum(o.items, i => i.qty)),
                    subtotal: sum(paid, o => o.subtotal),
                    discount: sum(paid, o => o.itemDiscount + o.orderDiscount),
                    total: sum(paid, o => o.total),
                    voided: orders.length - paid.length,
                    needsReview: paid.filter(o => o.needsReview).length,
                    pendingPickup: paid.filter(o => o.pickupStatus === 'PENDING').length,
                },
                byMethod,
                byDay: Object.values(byDay),
                byProduct: Object.values(byProduct).sort((a, b) => b.net - a.net),
                shifts: await Promise.all(shifts.map(async s => ({ ...s.toJSON(), summary: await shiftSummary(s) }))),
                pendingPickup: paid.filter(o => o.pickupStatus === 'PENDING').map(o => ({
                    id: o.id, orderNumber: o.orderNumber, pickupCode: o.pickupCode, customerName: o.customerName, customerPhone: o.customerPhone,
                    soldAt: o.soldAt, items: o.items.map(i => ({ name: i.name, variant: i.variant, qty: i.qty })),
                })),
                needsReview: paid.filter(o => o.needsReview).map(o => ({ id: o.id, orderNumber: o.orderNumber, soldAt: o.soldAt, reviewNote: o.reviewNote })),
            });
        } catch (err) { next(err); }
    }
}

module.exports = PosController;
