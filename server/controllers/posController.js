'use strict';
const {
    PosEvent, PosShift, PosOrder, PosOrderItem, PosPayment,
    Stock_Out_Header, Stock_Movement, Stock, SkuWarehouseStock,
    Product, ProductSKU, ProductVariantOption, Warehouse, Channel, User, Category, Role, RolePermission, sequelize,
} = require('../models');
const { compare } = require('../helpers/bcrypt');
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
    { model: PosOrder,     as: 'exchangeOf', attributes: ['id', 'orderNumber'] },
];

async function findEvent(req, id, t) {
    return PosEvent.findOne({ where: { id, ...companyFilter(req) }, transaction: t });
}

// Nilai kembali per pcs tiap SKU di transaksi asal = harga setelah diskon item & bagian diskon transaksi.
// Kasir tidak lagi punya fitur tukar; server tetap menerimanya untuk transaksi tukar lama yang masih antre di laptop.
function returnCredits(order) {
    const sold = order.items.filter(i => i.qty > 0);
    const lineNet = (i) => i.qty * i.unitPrice - (i.discount || 0);
    const base = sold.reduce((s, i) => s + lineNet(i), 0);
    const od = order.orderDiscount || 0;
    const out = {};
    for (const i of sold) {
        if (out[i.ProductSKUId]) continue;
        const net = lineNet(i) - (base ? Math.round(od * lineNet(i) / base) : 0);
        out[i.ProductSKUId] = { credit: Math.round(net / i.qty), qty: i.qty };
    }
    return out;
}

// Jumlah pcs per SKU yang sudah dikembalikan lewat transaksi tukar (yang tidak dibatalkan).
async function returnedQty(orderId, t) {
    const rows = await PosOrder.findAll({
        where: { exchangeOfOrderId: orderId, status: 'PAID' }, include: [{ model: PosOrderItem, as: 'items' }], transaction: t,
    });
    const out = {};
    for (const o of rows) for (const i of o.items) if (i.qty < 0) out[i.ProductSKUId] = (out[i.ProductSKUId] || 0) - i.qty;
    return out;
}

// Batas beli per orang: { qty, productIds: [] (kosong = semua produk), perPhone }
function normLimit(v) {
    if (!v || !Number(v.qty)) return null;
    const qty = Number(v.qty);
    if (!isInt(qty, 1)) return undefined;
    const productIds = [...new Set((Array.isArray(v.productIds) ? v.productIds : []).map(Number).filter(n => isInt(n, 1)))];
    // per: 'SKU' = dihitung per size (SKU), 'PRODUCT' = per artikel (semua size digabung)
    return { qty, productIds, perPhone: !!v.perPhone, per: v.per === 'SKU' ? 'SKU' : 'PRODUCT' };
}
// Gudang cadangan event: unik, milik company yang sama, bukan gudang event itu sendiri.
// Mengembalikan null kalau ada gudang yang tidak valid.
async function normBackups(ids, mainWarehouseId, cid) {
    const list = [...new Set((Array.isArray(ids) ? ids : []).map(Number))].filter(id => id !== Number(mainWarehouseId));
    if (list.some(id => !isInt(id, 1))) return null;
    if (!list.length) return [];
    const found = await Warehouse.count({ where: { id: list, ...(cid ? { companyId: cid } : {}) } });
    return found === list.length ? list : null;
}
// ── Persetujuan SPV di laptop kasir ─────────────────────────────────────────
const VOID_KEYS = ['pos.manage', 'pos.void'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN'];
// Password salah berulang dikunci sementara per SPV (cegah tebak-tebakan dari laptop kasir)
const approvalFails = new Map(); // approverId -> { count, until }
const MAX_FAILS = 5, LOCK_MS = 10 * 60_000;

// Id user (aktif, satu company) yang boleh void: admin, atau role-nya punya pos.manage / pos.void
async function voidApproverIds(cid) {
    const users = await User.findAll({ where: { companyId: cid, isActive: true }, attributes: ['id', 'name', 'role'], order: [['name', 'ASC']] });
    const roles = await Role.findAll({
        where: { name: [...new Set(users.map(u => u.role))], [Op.or]: [{ companyId: cid }, { companyId: null }] },
        include: [{ model: RolePermission, as: 'rolePermissions', where: { permissionKey: VOID_KEYS }, required: true }],
    });
    const ok = new Set(roles.map(r => r.name));
    return users.filter(u => ADMIN_ROLES.includes(u.role) || ok.has(u.role));
}

const limited = (limit, productId) => !!limit?.qty && (!limit.productIds?.length || limit.productIds.includes(productId));
// Kunci hitungan batas beli: per SKU (size) atau per artikel
const limitKey = (limit, ProductId, ProductSKUId) => limit.per === 'SKU' ? ProductSKUId : ProductId;

// Ringkasan pembayaran sebuah shift; dipakai saat tutup shift & di layar kasir.
async function shiftSummary(shift) {
    const orders = await PosOrder.findAll({
        where: { shiftId: shift.id, status: ['PAID', 'VOID'] },
        include: [{ model: PosPayment, as: 'payments' }, { model: PosOrderItem, as: 'items', attributes: ['qty'] }],
    });
    const byMethod = Object.fromEntries(PAY_METHODS.map(m => [m, 0]));
    let total = 0, discount = 0, pcs = 0, laterCount = 0, orderCount = 0, voidCount = 0, voidTotal = 0;
    for (const o of orders) {
        if (o.status === 'VOID') { voidCount += 1; voidTotal += o.total; continue; }
        orderCount += 1;
        total += o.total;
        discount += o.itemDiscount + o.orderDiscount;
        pcs += o.items.reduce((s, i) => s + i.qty, 0);
        if (o.fulfillment === 'LATER') laterCount += 1;
        for (const p of o.payments) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    }
    const expectedCash = shift.openingCash + byMethod.CASH;
    return {
        orderCount, total, discount, pcs, laterCount, voidCount, voidTotal, byMethod, expectedCash,
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
            const purchaseLimit = normLimit(req.body.purchaseLimit);
            if (purchaseLimit === undefined) return bad(res, 'Batas beli harus angka bulat ≥ 1');
            const cid = companyId(req);
            const wh = await Warehouse.findOne({ where: { id: WarehouseId, ...(cid ? { companyId: cid } : {}) } });
            if (!wh) return bad(res, 'Gudang tidak ditemukan');
            const ch = await Channel.findOne({ where: { id: ChannelId, ...(cid ? { companyId: cid } : {}) } });
            if (!ch) return bad(res, 'Channel tidak ditemukan');
            const backupWarehouseIds = await normBackups(req.body.backupWarehouseIds, WarehouseId, cid);
            if (!backupWarehouseIds) return bad(res, 'Gudang cadangan tidak ditemukan');
            const ev = await PosEvent.create({
                name, location, startDate, endDate, WarehouseId, ChannelId, receiptHeader, receiptFooter, purchaseLimit, backupWarehouseIds,
                status: 'PREP', createdBy: req.user.id, companyId: cid,
            });
            res.status(201).json(ev);
        } catch (err) { next(err); }
    }

    // Batas beli dari pengaturan kasir (izin pos.settings) — berlaku untuk semua laptop event ini
    static async updatePurchaseLimit(req, res, next) {
        try {
            const ev = await findEvent(req, req.params.id);
            if (!ev) throw { name: 'NotFound', message: 'Event tidak ditemukan' };
            const limit = normLimit(req.body.purchaseLimit);
            if (limit === undefined) return bad(res, 'Batas beli harus angka bulat ≥ 1');
            await ev.update({ purchaseLimit: limit });
            res.json({ purchaseLimit: ev.purchaseLimit });
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
            if (req.body.purchaseLimit !== undefined) {
                const limit = normLimit(req.body.purchaseLimit);
                if (limit === undefined) return bad(res, 'Batas beli harus angka bulat ≥ 1');
                updates.purchaseLimit = limit;
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
            // gudang cadangan boleh diganti kapan saja (hanya untuk info stok di kasir)
            if (req.body.backupWarehouseIds !== undefined || updates.WarehouseId !== undefined) {
                const ids = req.body.backupWarehouseIds !== undefined ? req.body.backupWarehouseIds : ev.backupWarehouseIds;
                const backups = await normBackups(ids, updates.WarehouseId ?? ev.WarehouseId, ev.companyId);
                if (!backups) return bad(res, 'Gudang cadangan tidak ditemukan');
                updates.backupWarehouseIds = backups;
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
            // stok gudang cadangan per SKU: { [skuId]: { [warehouseId]: qty } }, hanya yang > 0
            const backupIds = ev.backupWarehouseIds || [];
            const booth = await Warehouse.findByPk(ev.WarehouseId, { attributes: ['name'] });
            const backupWarehouses = backupIds.length
                ? await Warehouse.findAll({ where: { id: backupIds }, attributes: ['id', 'name'] })
                : [];
            const backupStock = {};
            if (backupIds.length) {
                const rows = await SkuWarehouseStock.findAll({ where: { WarehouseId: backupIds, qty: { [Op.gt]: 0 } }, attributes: ['ProductSKUId', 'WarehouseId', 'qty'] });
                for (const r of rows) (backupStock[r.ProductSKUId] = backupStock[r.ProductSKUId] || {})[r.WarehouseId] = r.qty;
            }
            res.json({
                event: {
                    id: ev.id, name: ev.name, location: ev.location, status: ev.status, WarehouseId: ev.WarehouseId, warehouseName: booth?.name || null, receiptHeader: ev.receiptHeader, receiptFooter: ev.receiptFooter, purchaseLimit: ev.purchaseLimit || null,
                    // urut sesuai pengaturan event
                    backupWarehouses: backupIds.map(id => backupWarehouses.find(w => w.id === id)).filter(Boolean).map(w => ({ id: w.id, name: w.name })),
                },
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
                    ...(backupStock[s.id] ? { backupStock: backupStock[s.id] } : {}),
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
            // tukar barang: item qty negatif = barang dikembalikan dari transaksi asal
            const hasReturn = items.some(i => Number(i.qty) < 0);
            let orig = null, credits = {};
            if (hasReturn || b.exchangeOfClientId) {
                orig = b.exchangeOfClientId && await PosOrder.findOne({
                    where: { companyId: cid, clientOrderId: b.exchangeOfClientId }, include: [{ model: PosOrderItem, as: 'items' }],
                });
                if (!orig) return bad(res, 'Transaksi asal tukar belum ada di server (kirim transaksi asalnya dulu)');
                if (orig.eventId !== ev.id) return bad(res, 'Tukar hanya untuk transaksi di event yang sama');
                credits = returnCredits(orig);
            }
            const skuIds = [...new Set(items.map(i => Number(i.ProductSKUId)))];
            const skus = await ProductSKU.findAll({
                where: { id: skuIds, companyId: ev.companyId },
                include: [
                    { model: Product, attributes: ['id', 'name'] },
                    { model: ProductVariantOption, attributes: ['value'], through: { attributes: [] } },
                ],
            });
            const skuMap = Object.fromEntries(skus.map(s => [s.id, s]));

            let subtotal = 0, itemDiscount = 0, returnTotal = 0;
            const lines = [];
            for (const i of items) {
                const sku = skuMap[Number(i.ProductSKUId)];
                const qty = Number(i.qty);
                if (!sku) return bad(res, `SKU ${i.ProductSKUId} tidak ditemukan`);
                if (Number.isInteger(qty) && qty < 0) {
                    // nilai barang kembali dihitung server dari transaksi asal, bukan dari kiriman kasir
                    const c = credits[sku.id];
                    if (!c) return bad(res, `${sku.sku_code} tidak ada di transaksi asal ${orig.orderNumber}`);
                    returnTotal += -qty * c.credit;
                    lines.push({
                        sku, qty, unitPrice: c.credit, discount: 0, lineTotal: qty * c.credit, isReturn: true,
                        name: sku.Product?.name || sku.sku_code,
                        variant: (sku.ProductVariantOptions || []).map(o => o.value).join(' / ') || null,
                        listPrice: Math.round(Number(sku.price) || 0),
                    });
                    continue;
                }
                const unitPrice = Number(i.unitPrice), discount = Number(i.discount || 0);
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
            const total = subtotal - itemDiscount - orderDiscount - returnTotal;

            const payments = Array.isArray(b.payments) ? b.payments : [];
            for (const p of payments) {
                const amount = Number(p.amount);
                // total negatif (barang baru lebih murah dari yang dikembalikan) = uang tunai dikembalikan ke pembeli
                const refund = total < 0 && p.method === 'CASH' && isInt(-amount, 1);
                if (!PAY_METHODS.includes(p.method) || !(isInt(amount, 1) || refund)) return bad(res, 'Pembayaran tidak valid');
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
            if (orig) {
                if (orig.status === 'VOID') review.push(`Tukar dari transaksi ${orig.orderNumber} yang sudah dibatalkan`);
                const already = await returnedQty(orig.id);
                for (const l of lines.filter(x => x.isReturn)) {
                    const back = (already[l.sku.id] || 0) - l.qty;
                    if (back > credits[l.sku.id].qty) review.push(`${l.sku.sku_code} dikembalikan ${back} pcs, padahal dibeli ${credits[l.sku.id].qty} di ${orig.orderNumber}`);
                }
            }
            if (total < 0) review.push(`Uang dikembalikan ke pembeli ${-total}`);

            // batas beli: dihitung bersih per artikel / per SKU (barang baru - barang yang dikembalikan); tidak menolak, ditandai
            const limit = ev.purchaseLimit;
            if (limit?.qty) {
                const net = {};
                for (const l of lines) {
                    if (!limited(limit, l.sku.ProductId)) continue;
                    const k = limitKey(limit, l.sku.ProductId, l.sku.id);
                    net[k] = (net[k] || 0) + l.qty;
                }
                const phone = String(b.customerPhone || '').replace(/[^\d+]/g, '');
                if (limit.perPhone && phone && Object.keys(net).length) {
                    const prev = await PosOrder.findAll({
                        where: { eventId: ev.id, status: 'PAID', customerPhone: phone }, include: [{ model: PosOrderItem, as: 'items' }],
                    });
                    for (const o of prev) for (const i of o.items) {
                        const k = limitKey(limit, i.ProductId, i.ProductSKUId);
                        if (net[k] != null) net[k] += i.qty;
                    }
                }
                for (const [key, q] of Object.entries(net)) {
                    if (q > limit.qty) {
                        const l = lines.find(x => limitKey(limit, x.sku.ProductId, x.sku.id) === Number(key));
                        const what = limit.per === 'SKU' ? `${l.name}${l.variant ? ` ${l.variant}` : ''}` : l.name;
                        review.push(`Lewat batas beli: ${what} ${q} pcs (maks ${limit.qty}${limit.per === 'SKU' ? ' per size' : ''}${limit.perPhone && phone ? ' per No. HP' : ''})`);
                    }
                }
            }

            const t = await sequelize.transaction();
            try {
                const sold = lines.filter(l => !l.isReturn);
                const header = sold.length ? await Stock_Out_Header.create({
                    WarehouseId: ev.WarehouseId, date: soldAt, purpose: 'Penjualan', ChannelId: ev.ChannelId,
                    notes: `POS ${b.orderNumber} - ${ev.name}`, status: 'closed', createdBy: req.user.id, companyId: ev.companyId,
                }, { transaction: t }) : null;

                for (const l of sold) {
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
                    subtotal, itemDiscount, orderDiscount, returnTotal, total, exchangeOfOrderId: orig?.id || null,
                    cashReceived, change: cashReceived != null ? cashReceived - cashPart : 0,
                    customerName: String(b.customerName || '').trim().slice(0, 100) || null,
                    fulfillment, pickupCode: String(b.pickupCode || '').slice(0, 20) || null,
                    pickupStatus: fulfillment === 'LATER' ? 'PENDING' : 'DONE',
                    pickedUpAt: fulfillment === 'LATER' ? null : soldAt,
                    customerPhone: String(b.customerPhone || '').replace(/[^\d+]/g, '').slice(0, 30) || null,
                    discountNote: b.discountNote || null, note: b.note || null, status: 'PAID',
                    needsReview: review.length > 0, reviewNote: review.join('; ') || null,
                    StockOutHeaderId: header?.id || null,
                }, { transaction: t });
                // barang yang dikembalikan masuk lagi ke gudang event
                for (const l of lines.filter(x => x.isReturn)) {
                    const ProductSKUId = l.sku.id, ProductId = l.sku.ProductId, WarehouseId = ev.WarehouseId, qty = -l.qty;
                    await l.sku.increment('qty', { by: qty, transaction: t });
                    await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, WarehouseId, delta: qty, companyId: ev.companyId });
                    const [stock] = await Stock.findOrCreate({
                        where: { ProductId, WarehouseId }, defaults: { quantity: 0, companyId: ev.companyId }, transaction: t,
                    });
                    await stock.increment('quantity', { by: qty, transaction: t });
                    await Stock_Movement.create({
                        ProductId, ProductSKUId, WarehouseId, type: 'IN', quantity: qty, ReferenceId: order.id, source: 'POS_RETURN',
                        note: `Tukar POS ${b.orderNumber} (dari ${orig.orderNumber})`, date: soldAt, companyId: ev.companyId,
                    }, { transaction: t });
                }
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

    // Cari transaksi asal untuk tukar barang (scan barcode struk / ketik nomor struk).
    static async lookupOrder(req, res, next) {
        try {
            const number = String(req.query.number || '').trim();
            if (!number) return bad(res, 'Nomor struk wajib diisi');
            const order = await PosOrder.findOne({ where: { orderNumber: { [Op.iLike]: number }, ...companyFilter(req) }, include: ORDER_INCLUDE });
            if (!order) throw { name: 'NotFound', message: `Struk ${number} tidak ditemukan` };
            res.json({ order, returned: await returnedQty(order.id) });
        } catch (err) { next(err); }
    }

    static async listOrders(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const where = { ...companyFilter(req) };
            for (const k of ['eventId', 'shiftId', 'status', 'fulfillment', 'pickupStatus']) if (req.query[k]) where[k] = req.query[k];
            if (req.query.needsReview === 'true') where.needsReview = true;
            if (req.query.exchange === 'true') where.exchangeOfOrderId = { [Op.ne]: null };
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

    // Daftar SPV yang bisa menyetujui pembatalan di laptop kasir
    static async approvers(req, res, next) {
        try {
            const list = await voidApproverIds(companyId(req));
            res.json(list.map(u => ({ id: u.id, name: u.name })));
        } catch (err) { next(err); }
    }

    // Void dari laptop kasir: SPV memilih namanya & mengetik password; yang tercatat membatalkan = SPV
    static async voidApproved(req, res, next) {
        try {
            const { approverId, password } = req.body || {};
            if (!approverId || !password) return bad(res, 'Pilih SPV dan isi password');
            const lock = approvalFails.get(Number(approverId));
            if (lock?.until > Date.now()) return res.status(429).json({ message: 'Terlalu banyak password salah. Coba lagi 10 menit lagi.' });

            const spv = (await voidApproverIds(companyId(req))).find(u => u.id === Number(approverId));
            const user = spv && await User.findByPk(spv.id, { attributes: ['id', 'name', 'password'] });
            if (!user || !compare(String(password), user.password)) {
                if (spv) {
                    const count = (lock?.count || 0) + 1;
                    approvalFails.set(spv.id, count >= MAX_FAILS ? { count: 0, until: Date.now() + LOCK_MS } : { count, until: 0 });
                }
                return res.status(403).json({ message: 'Password SPV salah atau tidak punya izin membatalkan' });
            }
            approvalFails.delete(user.id);
            req.voidBy = user.id;
            req.body.reason = req.body.reason && `${req.body.reason} · disetujui ${user.name} di kasir ${req.user.name || req.user.email}`;
            return PosController.voidOrder(req, res, next);
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
            const swaps = await PosOrder.count({ where: { exchangeOfOrderId: order.id, status: 'PAID' }, transaction: t });
            if (swaps) { await t.rollback(); return bad(res, 'Transaksi ini sudah pernah ditukar — batalkan transaksi tukarnya dulu'); }

            // barang yang dikembalikan lewat tukar keluar lagi dari gudang
            const returns = await Stock_Movement.findAll({ where: { ReferenceId: order.id, source: 'POS_RETURN', type: 'IN' }, transaction: t });
            for (const mv of returns) {
                const stock = await Stock.findOne({ where: { ProductId: mv.ProductId, WarehouseId: mv.WarehouseId }, transaction: t });
                if (stock) await stock.update({ quantity: Math.max(0, Number(stock.quantity) - mv.quantity) }, { transaction: t });
                if (mv.ProductSKUId) {
                    await ProductSKU.decrement('qty', { by: mv.quantity, where: { id: mv.ProductSKUId }, transaction: t });
                    await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: mv.ProductSKUId, WarehouseId: mv.WarehouseId, delta: -mv.quantity, companyId: mv.companyId });
                }
            }
            if (returns.length) await Stock_Movement.destroy({ where: { ReferenceId: order.id, source: 'POS_RETURN' }, transaction: t });

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
                status: 'VOID', voidedAt: new Date(), voidedBy: req.voidBy || req.user.id, voidReason: req.body.reason, StockOutHeaderId: null,
            }, { transaction: t });
            await t.commit();
            res.json(await PosOrder.findByPk(order.id, { include: ORDER_INCLUDE }));
        } catch (err) { if (!t.finished) await t.rollback(); next(err); }
    }

    // ── Laporan event ────────────────────────────────────────────────────────
    // Satu endpoint untuk semua tab laporan: ringkasan, waktu, produk (+ sell-through), kasir & bayar, pelanggan, antar event.
    static async report(req, res, next) {
        try {
            const ev = await findEvent(req, req.params.id);
            if (!ev) throw { name: 'NotFound', message: 'Event tidak ditemukan' };
            const orders = await PosOrder.findAll({ where: { eventId: ev.id }, include: ORDER_INCLUDE, order: [['soldAt', 'ASC']] });
            const paid = orders.filter(o => o.status === 'PAID');
            const sales = paid.filter(o => !o.exchangeOfOrderId);   // transaksi jual biasa (tanpa tukar) untuk rata-rata belanja
            const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
            const soldQty = (o) => sum(o.items.filter(i => i.qty > 0), i => i.qty);
            // jam & tanggal lokal WIB supaya transaksi malam tidak pindah hari
            const wib = (d) => new Date(new Date(d).getTime() + 7 * 3600e3);

            const byMethod = Object.fromEntries(PAY_METHODS.map(m => [m, 0]));
            const methodOrders = Object.fromEntries(PAY_METHODS.map(m => [m, 0]));
            const byDay = {}, byHour = {}, bySku = {}, byCashier = {}, byDevice = {}, customers = {};
            const shifts = await PosShift.findAll({ where: { eventId: ev.id }, include: [{ model: User, as: 'Cashier', attributes: ['id', 'name'] }], order: [['openedAt', 'ASC']] });
            const deviceOf = Object.fromEntries(shifts.map(s => [s.id, s.deviceName || `Shift #${s.id}`]));

            for (const o of paid) {
                for (const p of o.payments) byMethod[p.method] += p.amount;
                for (const m of new Set(o.payments.filter(p => p.amount > 0).map(p => p.method))) methodOrders[m] += 1;
                const t = wib(o.soldAt), day = t.toISOString().slice(0, 10), hour = t.getUTCHours();
                const pcs = soldQty(o);
                byDay[day] = byDay[day] || { day, orders: 0, qty: 0, total: 0 };
                byDay[day].orders += 1; byDay[day].qty += pcs; byDay[day].total += o.total;
                byHour[hour] = byHour[hour] || { hour, orders: 0, qty: 0, total: 0 };
                byHour[hour].orders += 1; byHour[hour].qty += pcs; byHour[hour].total += o.total;
                const cashier = o.Cashier?.name || '—';
                byCashier[cashier] = byCashier[cashier] || { name: cashier, orders: 0, qty: 0, total: 0, exchanges: 0 };
                const dev = deviceOf[o.shiftId] || 'Tanpa shift';
                byDevice[dev] = byDevice[dev] || { name: dev, orders: 0, qty: 0, total: 0, exchanges: 0 };
                for (const g of [byCashier[cashier], byDevice[dev]]) { g.orders += 1; g.qty += pcs; g.total += o.total; if (o.exchangeOfOrderId) g.exchanges += 1; }
                for (const i of o.items) {
                    const k = i.ProductSKUId || `x-${i.name}-${i.variant}`;
                    bySku[k] = bySku[k] || { ProductSKUId: i.ProductSKUId, ProductId: i.ProductId, name: i.name, variant: i.variant, sold: 0, returned: 0, gross: 0, discount: 0, net: 0 };
                    const b = bySku[k];
                    if (i.qty > 0) { b.sold += i.qty; b.gross += i.qty * i.unitPrice; b.discount += i.discount; } else b.returned -= i.qty;
                    b.net += i.lineTotal;
                }
                const phone = o.customerPhone;
                if (phone) {
                    const c = customers[phone] = customers[phone] || { last4: phone.slice(-4), name: null, orders: 0, qty: 0, total: 0, firstAt: o.soldAt, lastAt: o.soldAt };
                    if (o.customerName) c.name = o.customerName;
                    if (!o.exchangeOfOrderId) c.orders += 1;
                    c.qty += pcs; c.total += o.total; c.lastAt = o.soldAt;
                }
            }

            // stok: dibawa = barang masuk ke gudang event (transfer / stock in), sisa = stok gudang event sekarang
            const [moves, left] = await Promise.all([
                Stock_Movement.findAll({
                    where: { WarehouseId: ev.WarehouseId, type: 'IN', source: ['TRANSFER', 'STOCK_IN'], ProductSKUId: { [Op.ne]: null } },
                    attributes: ['ProductSKUId', [sequelize.fn('SUM', sequelize.col('quantity')), 'qty']], group: ['ProductSKUId'], raw: true,
                }),
                SkuWarehouseStock.findAll({ where: { WarehouseId: ev.WarehouseId }, attributes: ['ProductSKUId', 'qty'], raw: true }),
            ]);
            const brought = Object.fromEntries(moves.map(m => [m.ProductSKUId, Number(m.qty)]));
            const leftQty = Object.fromEntries(left.map(m => [m.ProductSKUId, Number(m.qty)]));
            // SKU yang dibawa tapi belum terjual tetap tampil (sell-through 0%)
            const missing = Object.keys(brought).map(Number).filter(id => !bySku[id]);
            if (missing.length) {
                const skus = await ProductSKU.findAll({
                    where: { id: missing }, attributes: ['id', 'ProductId'],
                    include: [{ model: Product, attributes: ['name'] }, { model: ProductVariantOption, attributes: ['value'], through: { attributes: [] } }],
                });
                for (const k of skus) bySku[k.id] = { ProductSKUId: k.id, ProductId: k.ProductId, name: k.Product?.name || `SKU ${k.id}`, variant: (k.ProductVariantOptions || []).map(o => o.value).join(' / ') || null, sold: 0, returned: 0, gross: 0, discount: 0, net: 0 };
            }
            const skuRows = Object.values(bySku).map(b => ({ ...b, qty: b.sold - b.returned, brought: brought[b.ProductSKUId] ?? null, left: leftQty[b.ProductSKUId] ?? null }));
            const byArticle = {};
            for (const b of skuRows) {
                const k = b.ProductId || b.name;
                const a = byArticle[k] = byArticle[k] || { ProductId: b.ProductId, name: b.name, sold: 0, returned: 0, gross: 0, discount: 0, net: 0, brought: 0, left: 0, hasStock: false, skus: [] };
                for (const f of ['sold', 'returned', 'gross', 'discount', 'net']) a[f] += b[f];
                if (b.brought != null) { a.brought += b.brought; a.hasStock = true; }
                a.left += b.left || 0;
                a.skus.push(b);
            }

            // perbandingan dengan event lain di perusahaan yang sama
            const [compare] = await sequelize.query(`
                SELECT e.id, e.name, e."startDate", e."endDate", e.status,
                       COALESCE(SUM(i.qty) FILTER (WHERE i.qty > 0), 0)::int AS qty
                FROM "PosEvents" e
                LEFT JOIN "PosOrders" o ON o."eventId" = e.id AND o.status = 'PAID'
                LEFT JOIN "PosOrderItems" i ON i."orderId" = o.id
                WHERE e."companyId" ${ev.companyId == null ? 'IS NULL' : '= :cid'}
                GROUP BY e.id ORDER BY e."createdAt" DESC`, { replacements: { cid: ev.companyId } });
            const totalsByEvent = await PosOrder.findAll({
                where: { status: 'PAID', eventId: compare.map(c => c.id) },
                attributes: ['eventId', [sequelize.fn('SUM', sequelize.col('total')), 'total'], [sequelize.fn('COUNT', sequelize.col('id')), 'orders']],
                group: ['eventId'], raw: true,
            });
            const tbe = Object.fromEntries(totalsByEvent.map(r => [r.eventId, r]));

            const customerList = Object.values(customers);
            const soldPcs = sum(paid, soldQty);
            res.json({
                event: ev,
                totals: {
                    orders: paid.length,
                    salesOrders: sales.length,
                    qty: sum(paid, o => sum(o.items, i => i.qty)),
                    soldQty: soldPcs,
                    subtotal: sum(paid, o => o.subtotal),
                    discount: sum(paid, o => o.itemDiscount + o.orderDiscount),
                    returns: sum(paid, o => o.returnTotal),
                    refunds: sum(paid.filter(o => o.total < 0), o => -o.total),
                    exchanges: paid.filter(o => o.exchangeOfOrderId).length,
                    total: sum(paid, o => o.total),
                    aov: sales.length ? Math.round(sum(sales, o => o.total) / sales.length) : 0,
                    upt: sales.length ? Math.round(sum(sales, soldQty) / sales.length * 100) / 100 : 0,
                    voided: orders.length - paid.length,
                    voidedTotal: sum(orders.filter(o => o.status === 'VOID'), o => o.total),
                    needsReview: paid.filter(o => o.needsReview).length,
                    pendingPickup: paid.filter(o => o.pickupStatus === 'PENDING').length,
                    later: paid.filter(o => o.fulfillment === 'LATER').length,
                    customers: customerList.length,
                    repeatCustomers: customerList.filter(c => c.orders >= 2).length,
                    withPhone: sales.filter(o => o.customerPhone).length,
                    limitHits: paid.filter(o => /Lewat batas beli/.test(o.reviewNote || '')).length,
                    brought: sum(Object.values(brought), x => x),
                },
                byMethod, methodOrders,
                byDay: Object.values(byDay),
                byHour: Object.values(byHour).sort((a, b) => a.hour - b.hour),
                byProduct: skuRows.sort((a, b) => b.net - a.net),
                byArticle: Object.values(byArticle).sort((a, b) => b.net - a.net),
                byCashier: Object.values(byCashier).sort((a, b) => b.total - a.total),
                byDevice: Object.values(byDevice).sort((a, b) => b.total - a.total),
                customers: customerList.sort((a, b) => b.total - a.total).slice(0, 50),
                compare: compare.map(c => ({ id: c.id, name: c.name, startDate: c.startDate, endDate: c.endDate, status: c.status, qty: c.qty, orders: Number(tbe[c.id]?.orders || 0), total: Number(tbe[c.id]?.total || 0) })),
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
