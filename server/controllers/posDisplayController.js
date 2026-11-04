'use strict';
const hub = require('../helpers/displayHub');
const { companyId } = require('../helpers/tenancy');

// Layar pelanggan di perangkat lain (iPad): kasir pairing -> kirim keadaan, layar long-poll.
class PosDisplayController {
  // POST /pos/display/pair { eventId, code? } -> { code }
  static async pair(req, res, next) {
    try {
      const { eventId, code } = req.body || {};
      if (!eventId) return res.status(400).json({ message: 'eventId wajib diisi' });
      const s = hub.pair(req.user, companyId(req), eventId, code);
      res.json({ code: s.code, viewers: hub.viewerCount(s) });
    } catch (err) { next(err); }
  }

  // PUT /pos/display/:code { eventId, state, qris? } -> { version, viewers }
  static async publish(req, res, next) {
    try {
      const { eventId, state, qris } = req.body || {};
      if (qris != null && (typeof qris !== 'string' || !qris.startsWith('data:image/'))) return res.status(400).json({ message: 'QRIS tidak valid' });
      const s = hub.publish(req.user, companyId(req), String(req.params.code), eventId, state, qris);
      if (!s) return res.status(409).json({ message: 'Kode layar dipakai kasir lain, minta kode baru' });
      res.json({ version: s.version, viewers: hub.viewerCount(s) });
    } catch (err) { next(err); }
  }

  // GET /pos/display/:code?since=&qv=&viewer= -> keadaan (ditahan sampai berubah / 25 dtk)
  static async watch(req, res, next) {
    try {
      const { since, qv, viewer } = req.query;
      const snap = await hub.wait(String(req.params.code), companyId(req), { since, qrisVersion: qv, viewerId: viewer }, req);
      if (snap === undefined) return; // koneksi ditutup layar
      if (!snap) return res.status(404).json({ message: 'Kode layar tidak ditemukan. Cek kode di laptop kasir.' });
      res.set('Cache-Control', 'no-store').json(snap);
    } catch (err) { next(err); }
  }
}

module.exports = PosDisplayController;
