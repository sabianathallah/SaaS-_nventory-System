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
    firstOrder = order();
    const res = await request(app).post('/pos/orders').set(auth()).send(firstOrder);
    expect(res.status).toBe(201);
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

describe('Tutup shift & laporan', () => {
  test('tutup shift menghitung kas yang seharusnya dan selisihnya', async () => {
    const res = await request(app).patch(`/pos/shifts/${shiftId}/close`).set(auth()).send({ countedCash: 1090000 });
    expect(res.status).toBe(200);
    // modal 500.000 + cash 600.000 (kembalian sudah keluar) = 1.100.000, dihitung 1.090.000
    expect(res.body.summary).toMatchObject({ orderCount: 2, expectedCash: 1100000, cashDifference: -10000 });
    expect(res.body.summary.byMethod).toMatchObject({ CASH: 600000, QRIS: 680000, EDC: 0 });
  });

  test('laporan event: total, metode bayar, produk, dan transaksi perlu dicek', async () => {
    const res = await request(app).get(`/pos/events/${eventId}/report`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ orders: 2, qty: 5, subtotal: 1350000, discount: 70000, total: 1280000, voided: 1, needsReview: 1 });
    expect(res.body.byProduct.map(p => [p.name, p.variant, p.qty])).toEqual(expect.arrayContaining([['Tshirt POS', null, 2], ['Tshirt POS', null, 3]]));
    expect(res.body.needsReview).toHaveLength(1);
  });
});
