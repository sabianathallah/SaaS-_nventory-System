'use strict';
process.env.NODE_ENV = 'test';

// Layar pelanggan di iPad: relay keadaan kasir lewat server (pairing kode + long-poll)
const request = require('supertest');
const app     = require('../app');
const { initDb } = require('./setup');
const hub = require('../helpers/displayHub');
const { Warehouse, Channel, PosEvent } = require('../models');

let state, eventId, code;
const admin = () => ({ Authorization: `Bearer ${state.tokens.admin}` });
const superA = () => ({ Authorization: `Bearer ${state.tokens.superAdmin}` });

beforeAll(async () => {
  state = await initDb();
  hub._sessions.clear();
  const cid = state.company.id;
  const wh = await Warehouse.create({ name: 'Booth Display', location: 'Mall', companyId: cid });
  const ch = await Channel.create({ name: 'Display Test', isActive: true, companyId: cid });
  const ev = await PosEvent.create({ name: 'Display Test', WarehouseId: wh.id, ChannelId: ch.id, status: 'OPEN', companyId: cid });
  eventId = ev.id;
});

describe('Pairing & kirim keadaan', () => {
  test('pair wajib eventId', async () => {
    const res = await request(app).post('/pos/display/pair').set(admin()).send({});
    expect(res.status).toBe(400);
  });

  test('pair memberi kode 4 digit, kode yang sama dipakai ulang', async () => {
    const res = await request(app).post('/pos/display/pair').set(admin()).send({ eventId });
    expect(res.status).toBe(200);
    expect(res.body.code).toMatch(/^\d{4}$/);
    code = res.body.code;
    const again = await request(app).post('/pos/display/pair').set(admin()).send({ eventId, code });
    expect(again.body.code).toBe(code);
  });

  test('layar langsung dapat keadaan awal (idle)', async () => {
    const res = await request(app).get(`/pos/display/${code}`).set(admin());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ code, eventId: String(eventId), version: 0, state: { phase: 'idle' } });
  });

  test('long-poll bangun begitu kasir mengirim keadaan baru', async () => {
    const t0 = Date.now();
    const wait = request(app).get(`/pos/display/${code}?since=0&qv=0&viewer=ipad1`).set(admin());
    await new Promise(r => setTimeout(r, 200));
    const put = await request(app).put(`/pos/display/${code}`).set(admin())
      .send({ eventId, state: { phase: 'cart', total: 249000, lines: [] } });
    expect(put.status).toBe(200);
    const res = await wait;
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(res.body.state).toMatchObject({ phase: 'cart', total: 249000 });
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  test('jumlah layar tersambung terlihat oleh kasir', async () => {
    const put = await request(app).put(`/pos/display/${code}`).set(admin()).send({ eventId, state: { phase: 'idle' } });
    expect(put.body.viewers).toBeGreaterThanOrEqual(1);
  });

  test('QRIS dikirim sekali; layar yang sudah punya versi terbaru tidak menerima ulang', async () => {
    const qris = 'data:image/png;base64,iVBORw0KGgo=';
    await request(app).put(`/pos/display/${code}`).set(admin()).send({ eventId, state: { phase: 'idle' }, qris });
    const first = await request(app).get(`/pos/display/${code}?qv=0`).set(admin());
    expect(first.body.qris).toBe(qris);
    const second = await request(app).get(`/pos/display/${code}?qv=${first.body.qrisVersion}`).set(admin());
    expect(second.body).not.toHaveProperty('qris');
  });

  test('QRIS bukan gambar ditolak', async () => {
    const res = await request(app).put(`/pos/display/${code}`).set(admin()).send({ eventId, state: {}, qris: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  test('QRIS besar (> 100 kb) tetap diterima', async () => {
    const qris = 'data:image/png;base64,' + 'A'.repeat(800_000);
    const res = await request(app).put(`/pos/display/${code}`).set(admin()).send({ eventId, state: { phase: 'idle' }, qris });
    expect(res.status).toBe(200);
  });
});

describe('Keamanan & pemulihan', () => {
  test('kode tidak dikenal = 404', async () => {
    const free = ['0000', '0001', '0002'].find(c => !hub._sessions.has(c));
    const res = await request(app).get(`/pos/display/${free}`).set(admin());
    expect(res.status).toBe(404);
  });

  test('kasir lain tidak bisa mengirim ke kode milik orang lain', async () => {
    const res = await request(app).put(`/pos/display/${code}?companyId=${state.company.id}`).set(superA())
      .send({ eventId, state: { phase: 'idle' } });
    expect(res.status).toBe(409);
  });

  test('perusahaan lain tidak bisa melihat layar', async () => {
    const res = await request(app).get(`/pos/display/${code}?companyId=999999`).set(superA());
    expect(res.status).toBe(404);
  });

  test('tanpa login ditolak', async () => {
    const res = await request(app).get(`/pos/display/${code}`);
    expect(res.status).toBe(401);
  });

  test('server restart: kiriman kasir berikutnya mendaftarkan ulang kode yang sama', async () => {
    hub._sessions.clear();
    const lost = await request(app).get(`/pos/display/${code}`).set(admin());
    expect(lost.status).toBe(404);
    const put = await request(app).put(`/pos/display/${code}`).set(admin()).send({ eventId, state: { phase: 'cart', total: 1 } });
    expect(put.status).toBe(200);
    const back = await request(app).get(`/pos/display/${code}`).set(admin());
    expect(back.status).toBe(200);
    expect(back.body.state.total).toBe(1);
  });
});

describe('Sembunyikan foto dari slideshow', () => {
  test('disimpan, dibersihkan, dan ikut di katalog', async () => {
    const up = await request(app).put(`/pos/events/${eventId}`).set(admin()).send({ displayHiddenProductIds: [3, '3', 'x', 7] });
    expect(up.status).toBe(200);
    expect(up.body.displayHiddenProductIds).toEqual([3, 7]);
    const cat = await request(app).get(`/pos/events/${eventId}/catalog`).set(admin());
    expect(cat.body.event.displayHiddenProductIds).toEqual([3, 7]);
    const clear = await request(app).put(`/pos/events/${eventId}`).set(admin()).send({ displayHiddenProductIds: [] });
    expect(clear.body.displayHiddenProductIds).toBeNull();
  });

  test('bukan daftar ditolak', async () => {
    const res = await request(app).put(`/pos/events/${eventId}`).set(admin()).send({ displayHiddenProductIds: 'abc' });
    expect(res.status).toBe(400);
  });
});
