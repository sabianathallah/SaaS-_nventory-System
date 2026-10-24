'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb } = require('./setup');
const {
  Product, ProductSKU, SkuWarehouseStock, Stock, Stock_Movement, Stock_Out_Header,
  Warehouse, Channel, PosOrder,
} = require('../models');

let state, wh, channel, product, skuA, skuB, eventId, shiftId;
const auth = () => ({ Authorization: `Bearer ${state.tokens.admin}` });
const swsQty = async (skuId) => (await SkuWarehouseStock.findOne({ where: { ProductSKUId: skuId, WarehouseId: wh.id } })).qty;

let seq = 0;
const order = (over = {}) => ({
  clientOrderId: `dev1-${Date.now()}-${++seq}`,
  orderNumber: `POP-1-${seq}`,
  eventId, shiftId,
  soldAt: new Date().toISOString(),
  items: [{ ProductSKUId: skuA.id, qty: 2, unitPrice: 300000, discount: 0 }],
  payments: [{ method: 'CASH', amount: 600000 }],
  cashReceived: 700000,
  ...over,
});

beforeAll(async () => {
  state = await initDb();
  const cid = state.company.id;
  wh = await Warehouse.create({ name: 'POP UP Test', location: 'Mall', companyId: cid });
  channel = await Channel.create({ name: 'Pop Up Test', isActive: true, companyId: cid });
  product = await Product.create({ name: 'Tshirt POS', CategoryId: state.category.id, unit: 'pcs', companyId: cid });
  skuA = await ProductSKU.create({ ProductId: product.id, sku_code: 'POS-A', price: 300000, qty: 5, companyId: cid });
  skuB = await ProductSKU.create({ ProductId: product.id, sku_code: 'POS-B', price: 250000, qty: 1, companyId: cid });
  await SkuWarehouseStock.bulkCreate([
    { ProductSKUId: skuA.id, WarehouseId: wh.id, qty: 5, companyId: cid },
    { ProductSKUId: skuB.id, WarehouseId: wh.id, qty: 1, companyId: cid },
  ]);
  await Stock.create({ ProductId: product.id, WarehouseId: wh.id, quantity: 6, companyId: cid });
});

describe('Event & shift', () => {
  test('buat event wajib gudang & channel', async () => {
    const res = await request(app).post('/pos/events').set(auth()).send({ name: 'Tanpa gudang' });
    expect(res.status).toBe(400);
  });

  test('buat event, kasir belum bisa buka shift sebelum event OPEN', async () => {
    const res = await request(app).post('/pos/events').set(auth())
      .send({ name: 'Pop Up 5 Nov', WarehouseId: wh.id, ChannelId: channel.id });
    expect(res.status).toBe(201);
    eventId = res.body.id;
    const sh = await request(app).post('/pos/shifts').set(auth()).send({ eventId, openingCash: 500000 });
    expect(sh.status).toBe(400);
  });

  test('event dibuka lalu shift dibuka', async () => {
    const up = await request(app).put(`/pos/events/${eventId}`).set(auth()).send({ status: 'OPEN' });
    expect(up.status).toBe(200);
    const sh = await request(app).post('/pos/shifts').set(auth()).send({ eventId, deviceName: 'Mac 1', openingCash: 500000 });
    expect(sh.status).toBe(201);
    shiftId = sh.body.id;
  });

  test('katalog berisi SKU + stok gudang event', async () => {
    const res = await request(app).get(`/pos/events/${eventId}/catalog`).set(auth());
    expect(res.status).toBe(200);
    const a = res.body.items.find(i => i.code === 'POS-A');
    expect(a).toMatchObject({ skuId: skuA.id, price: 300000, stock: 5, name: 'Tshirt POS' });
  });
});

describe('Transaksi', () => {
  let firstOrder;

  test('transaksi mengurangi stok gudang event lewat Stock Out Penjualan', async () => {
    firstOrder = order({ customerName: '  Andi  ', customerPhone: '0812-3456-7890' });
    const res = await request(app).post('/pos/orders').set(auth()).send(firstOrder);
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ customerName: 'Andi', customerPhone: '081234567890' });
    expect(res.body.order).toMatchObject({ total: 600000, change: 100000, needsReview: false, status: 'PAID' });
    expect(await swsQty(skuA.id)).toBe(3);
    const so = await Stock_Out_Header.findByPk(res.body.order.StockOutHeaderId);
    expect(so).toMatchObject({ purpose: 'Penjualan', ChannelId: channel.id, WarehouseId: wh.id });
    const mv = await Stock_Movement.findAll({ where: { ReferenceId: so.id, source: 'STOCK_OUT' } });
    expect(mv.map(m => m.quantity)).toEqual([2]);
  });

  test('transaksi yang dikirim ulang (offline) tidak tercatat dua kali', async () => {
    const res = await request(app).post('/pos/orders').set(auth()).send(firstOrder);
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(await swsQty(skuA.id)).toBe(3);
    expect(await PosOrder.count({ where: { clientOrderId: firstOrder.clientOrderId } })).toBe(1);
  });

  test('stok sistem kurang tetap diterima dan ditandai perlu dicek', async () => {
    const res = await request(app).post('/pos/orders').set(auth()).send(order({
      items: [{ ProductSKUId: skuB.id, qty: 3, unitPrice: 250000, discount: 50000 }],
      orderDiscount: 20000,
      payments: [{ method: 'QRIS', amount: 680000 }],
      cashReceived: null,
    }));
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ subtotal: 750000, itemDiscount: 50000, orderDiscount: 20000, total: 680000, needsReview: true });
    expect(res.body.order.reviewNote).toMatch(/POS-B/);
    expect(await swsQty(skuB.id)).toBe(-2);
  });

  test('pembayaran harus sama dengan total', async () => {
    const res = await request(app).post('/pos/orders').set(auth()).send(order({ payments: [{ method: 'CASH', amount: 500000 }] }));
    expect(res.status).toBe(400);
  });

  test('diskon tidak boleh melebihi harga', async () => {
    const res = await request(app).post('/pos/orders').set(auth()).send(order({
      items: [{ ProductSKUId: skuA.id, qty: 1, unitPrice: 300000, discount: 400000 }], payments: [],
    }));
    expect(res.status).toBe(400);
  });

  test('void mengembalikan stok dan menghapus Stock Out-nya', async () => {
    const created = await request(app).post('/pos/orders').set(auth()).send(order({
      items: [{ ProductSKUId: skuA.id, qty: 1, unitPrice: 300000 }], payments: [{ method: 'EDC', amount: 300000 }], cashReceived: null,
    }));
    const soId = created.body.order.StockOutHeaderId;
    expect(await swsQty(skuA.id)).toBe(2);
    const noReason = await request(app).post(`/pos/orders/${created.body.order.id}/void`).set(auth()).send({});
    expect(noReason.status).toBe(400);
    const res = await request(app).post(`/pos/orders/${created.body.order.id}/void`).set(auth()).send({ reason: 'Salah scan' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'VOID', StockOutHeaderId: null });
    expect(await swsQty(skuA.id)).toBe(3);
    expect(await Stock_Out_Header.findByPk(soId)).toBeNull();
    expect(await Stock_Movement.count({ where: { ReferenceId: soId, source: 'STOCK_OUT' } })).toBe(0);
  });
});

describe('Ambil nanti (antrean pengambilan)', () => {
  let later;
  test('transaksi ambil nanti masuk antrean dan bisa dicari dari 4 digit No. HP', async () => {
    const res = await request(app).post('/pos/orders').set(auth()).send(order({
      fulfillment: 'LATER', pickupCode: 'A-001', customerName: 'Budi', customerPhone: '081299998888',
      items: [{ ProductSKUId: skuA.id, qty: 1, unitPrice: 300000 }], payments: [{ method: 'QRIS', amount: 300000 }], cashReceived: null,
    }));
    expect(res.status).toBe(201);
    later = res.body.order;
    expect(later).toMatchObject({ fulfillment: 'LATER', pickupStatus: 'PENDING', pickupCode: 'A-001', pickedUpAt: null });
    const q = await request(app).get(`/pos/orders?eventId=${eventId}&pickupStatus=PENDING&search=8888`).set(auth());
    expect(q.body.data.map(o => o.id)).toEqual([later.id]);
  });

  test('transaksi langsung dibawa tidak bisa ditandai pengambilan', async () => {
    const now = (await PosOrder.findOne({ where: { eventId, fulfillment: 'NOW', status: 'PAID' } })).id;
    const res = await request(app).patch(`/pos/orders/${now}/pickup`).set(auth()).send({ status: 'DONE' });
    expect(res.status).toBe(400);
  });

  test('tandai sudah diambil lalu batalkan tanda', async () => {
    const done = await request(app).patch(`/pos/orders/${later.id}/pickup`).set(auth()).send({ status: 'DONE' });
    expect(done.body).toMatchObject({ pickupStatus: 'DONE' });
    expect(done.body.pickedUpAt).not.toBeNull();
    expect(done.body.PickedUpBy.id).toBe(state.admin.id);
    const undo = await request(app).patch(`/pos/orders/${later.id}/pickup`).set(auth()).send({ status: 'PENDING' });
    expect(undo.body).toMatchObject({ pickupStatus: 'PENDING', pickedUpAt: null });
  });
});

describe('Tutup shift & laporan', () => {
  test('tutup shift menghitung kas yang seharusnya dan selisihnya', async () => {
    const res = await request(app).patch(`/pos/shifts/${shiftId}/close`).set(auth()).send({ countedCash: 1090000 });
    expect(res.status).toBe(200);
    // modal 500.000 + cash 600.000 (kembalian sudah keluar) = 1.100.000, dihitung 1.090.000
    expect(res.body.summary).toMatchObject({ orderCount: 3, expectedCash: 1100000, cashDifference: -10000 });
    expect(res.body.summary.byMethod).toMatchObject({ CASH: 600000, QRIS: 980000, EDC: 0 });
  });

  test('laporan event: total, metode bayar, produk, dan transaksi perlu dicek', async () => {
    const res = await request(app).get(`/pos/events/${eventId}/report`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ orders: 3, qty: 6, subtotal: 1650000, discount: 70000, total: 1580000, voided: 1, needsReview: 1, pendingPickup: 1 });
    expect(res.body.pendingPickup[0]).toMatchObject({ pickupCode: 'A-001', customerName: 'Budi' });
    expect(res.body.byProduct.map(p => [p.name, p.variant, p.qty])).toEqual(expect.arrayContaining([['Tshirt POS', null, 3], ['Tshirt POS', null, 3]]));
    expect(res.body.needsReview).toHaveLength(1);
  });
});

describe('Tukar barang & batas beli', () => {
  let skuM, skuL, orig;
  const send = (body) => request(app).post('/pos/orders').set(auth()).send(order({ shiftId: null, cashReceived: null, ...body }));
  beforeAll(async () => {
    const cid = state.company.id;
    const p = await Product.create({ name: 'Hoodie Tukar', CategoryId: state.category.id, unit: 'pcs', companyId: cid });
    skuM = await ProductSKU.create({ ProductId: p.id, sku_code: 'TKR-M', price: 400000, qty: 10, companyId: cid });
    skuL = await ProductSKU.create({ ProductId: p.id, sku_code: 'TKR-L', price: 400000, qty: 10, companyId: cid });
    await SkuWarehouseStock.bulkCreate([
      { ProductSKUId: skuM.id, WarehouseId: wh.id, qty: 10, companyId: cid },
      { ProductSKUId: skuL.id, WarehouseId: wh.id, qty: 10, companyId: cid },
    ]);
    // dibeli dengan diskon item 40.000 + diskon transaksi 10.000 -> nilai kembali 350.000
    const res = await send({ items: [{ ProductSKUId: skuM.id, qty: 1, unitPrice: 400000, discount: 40000 }], orderDiscount: 10000, payments: [{ method: 'QRIS', amount: 350000 }] });
    orig = res.body.order;
  });

  test('tukar size: barang lama masuk stok, barang baru keluar, selisih dibayar', async () => {
    const res = await send({
      exchangeOfClientId: orig.clientOrderId,
      items: [{ ProductSKUId: skuM.id, qty: -1, unitPrice: 1 }, { ProductSKUId: skuL.id, qty: 1, unitPrice: 400000 }],
      payments: [{ method: 'CASH', amount: 50000 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ returnTotal: 350000, total: 50000, exchangeOfOrderId: orig.id, needsReview: false });
    expect(await swsQty(skuM.id)).toBe(10);
    expect(await swsQty(skuL.id)).toBe(9);
    const mv = await Stock_Movement.findOne({ where: { ReferenceId: res.body.order.id, source: 'POS_RETURN' } });
    expect(mv).toMatchObject({ type: 'IN', quantity: 1, ProductSKUId: skuM.id });

    const lookup = await request(app).get('/pos/orders/lookup').query({ number: orig.orderNumber }).set(auth());
    expect(lookup.body.returned).toEqual({ [skuM.id]: 1 });

    // transaksi asal tidak bisa di-void selama tukarnya masih ada; void tukar mengembalikan stok
    expect((await request(app).post(`/pos/orders/${orig.id}/void`).set(auth()).send({ reason: 'x' })).status).toBe(400);
    expect((await request(app).post(`/pos/orders/${res.body.order.id}/void`).set(auth()).send({ reason: 'x' })).status).toBe(200);
    expect(await swsQty(skuM.id)).toBe(9);
    expect(await swsQty(skuL.id)).toBe(10);
  });

  test('barang pengganti lebih murah: uang tunai dikembalikan & ditandai; retur berlebih ditandai', async () => {
    const ok = await send({ exchangeOfClientId: orig.clientOrderId, items: [{ ProductSKUId: skuM.id, qty: -1, unitPrice: 1 }], payments: [{ method: 'CASH', amount: -350000 }] });
    expect(ok.status).toBe(201);
    expect(ok.body.order).toMatchObject({ total: -350000, needsReview: true });
    const again = await send({ exchangeOfClientId: orig.clientOrderId, items: [{ ProductSKUId: skuM.id, qty: -1, unitPrice: 1 }], payments: [{ method: 'CASH', amount: -350000 }] });
    expect(again.body.order.reviewNote).toMatch(/dikembalikan 2 pcs/);
    const qris = await send({ exchangeOfClientId: orig.clientOrderId, items: [{ ProductSKUId: skuM.id, qty: -1, unitPrice: 1 }], payments: [{ method: 'QRIS', amount: -350000 }] });
    expect(qris.status).toBe(400);
    const noOrig = await send({ items: [{ ProductSKUId: skuM.id, qty: -1, unitPrice: 1 }], payments: [] });
    expect(noOrig.status).toBe(400);
  });

  test('batas beli per No. HP ditandai saat terlewati', async () => {
    const bad = await request(app).put(`/pos/events/${eventId}`).set(auth()).send({ purchaseLimit: { qty: 0.5 } });
    expect(bad.status).toBe(400);
    await request(app).put(`/pos/events/${eventId}`).set(auth()).send({ purchaseLimit: { qty: 1, productIds: [skuL.ProductId], perPhone: true } });
    const cat = await request(app).get(`/pos/events/${eventId}/catalog`).set(auth());
    expect(cat.body.event.purchaseLimit).toEqual({ qty: 1, productIds: [skuL.ProductId], perPhone: true });
    const buy = (phone) => send({ customerPhone: phone, items: [{ ProductSKUId: skuL.id, qty: 1, unitPrice: 400000 }], payments: [{ method: 'QRIS', amount: 400000 }] });
    expect((await buy('0811-111')).body.order.needsReview).toBe(false);
    const second = await buy('0811111');
    expect(second.body.order.needsReview).toBe(true);
    expect(second.body.order.reviewNote).toMatch(/Lewat batas beli/);
    expect((await buy('0822222')).body.order.needsReview).toBe(false);
    await request(app).put(`/pos/events/${eventId}`).set(auth()).send({ purchaseLimit: null });
  });
});

describe('Laporan lengkap', () => {
  test('ringkasan, per jam, per artikel + sell-through, kasir, pelanggan, antar event', async () => {
    const res = await request(app).get(`/pos/events/${eventId}/report`).set(auth());
    expect(res.status).toBe(200);
    const r = res.body;
    expect(r.totals.exchanges).toBeGreaterThan(0);
    expect(r.totals.refunds).toBeGreaterThan(0);
    expect(r.totals.aov).toBeGreaterThan(0);
    expect(r.totals.customers).toBeGreaterThan(0);
    expect(r.totals.limitHits).toBe(1);
    expect(r.byHour.reduce((s, h) => s + h.orders, 0)).toBe(r.totals.orders);
    const hoodie = r.byArticle.find(a => a.name === 'Hoodie Tukar');
    expect(hoodie.skus).toHaveLength(2);
    expect(hoodie.returned).toBeGreaterThan(0);
    expect(r.byCashier[0].orders).toBe(r.totals.orders);
    expect(r.compare.find(c => c.id === eventId)).toMatchObject({ orders: r.totals.orders, total: r.totals.total });
  });
});
