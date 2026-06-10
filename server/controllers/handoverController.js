'use strict';
const https = require('https');
const http  = require('http');
const path  = require('path');
const fs    = require('fs');
const { Handover, Handover_Item, User } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { destroyHandoverAttachment } = require('../helpers/cloudinary');

const MIME = {
  '.pdf':  'application/pdf',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
};

const ITEM_ORDER = [['scannedAt', 'ASC'], ['id', 'ASC']];

const HANDOVER_INCLUDE = [
  { model: User, as: 'User', attributes: ['id', 'name'] },
  { model: Handover_Item, order: ITEM_ORDER },
];

async function findHandover(id, req) {
  const h = await Handover.findOne({
    where: { id, ...companyFilter(req) },
    include: HANDOVER_INCLUDE,
    order: [[Handover_Item, 'scannedAt', 'ASC'], [Handover_Item, 'id', 'ASC']],
  });
  if (!h) throw { name: 'NotFound', message: 'Handover tidak ditemukan' };
  return h;
}

class HandoverController {
  static async list(req, res, next) {
    try {
      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(50, parseInt(req.query.limit) || 20);
      const offset = (page - 1) * limit;

      const where = { ...companyFilter(req) };
      if (req.query.status) where.status = req.query.status;

      const { count, rows } = await Handover.findAndCountAll({
        where,
        include: [
          { model: User, as: 'User', attributes: ['id', 'name'] },
          { model: Handover_Item, attributes: ['id'] },
        ],
        order: [['date', 'DESC'], ['id', 'DESC']],
        limit,
        offset,
        distinct: true,
      });

      res.json({
        rows: rows.map(h => ({
          ...h.toJSON(),
          totalResi: h.Handover_Items?.length ?? 0,
        })),
        count,
        totalPages: Math.ceil(count / limit),
        page,
      });
    } catch (err) { next(err); }
  }

  static async get(req, res, next) {
    try {
      const h = await findHandover(req.params.id, req);
      res.json(h);
    } catch (err) { next(err); }
  }

  static async create(req, res, next) {
    try {
      const { ekspedisi, date, note } = req.body;
      if (!ekspedisi?.trim()) throw { name: 'ValidationError', message: 'Ekspedisi wajib diisi' };
      if (!date) throw { name: 'ValidationError', message: 'Tanggal wajib diisi' };

      const h = await Handover.create({
        ekspedisi: ekspedisi.trim(),
        date,
        note: note?.trim() || null,
        createdBy: req.user.id,
        companyId: companyId(req),
      });
      const full = await findHandover(h.id, req);
      res.status(201).json(full);
    } catch (err) { next(err); }
  }

  static async update(req, res, next) {
    try {
      const h = await Handover.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!h) throw { name: 'NotFound', message: 'Handover tidak ditemukan' };

      const { ekspedisi, date, note } = req.body;
      if (ekspedisi !== undefined) h.ekspedisi = ekspedisi.trim();
      if (date      !== undefined) h.date      = date;
      if (note      !== undefined) h.note      = note?.trim() || null;
      await h.save();

      const full = await findHandover(h.id, req);
      res.json(full);
    } catch (err) { next(err); }
  }

  static async destroy(req, res, next) {
    try {
      const h = await Handover.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!h) throw { name: 'NotFound', message: 'Handover tidak ditemukan' };
      await h.destroy();
      res.json({ message: 'Handover dihapus' });
    } catch (err) { next(err); }
  }

  static async closeSession(req, res, next) {
    try {
      const h = await Handover.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!h) throw { name: 'NotFound', message: 'Handover tidak ditemukan' };
      h.status = 'CLOSED';
      await h.save();
      const full = await findHandover(h.id, req);
      res.json(full);
    } catch (err) { next(err); }
  }

  static async reopenSession(req, res, next) {
    try {
      const h = await Handover.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!h) throw { name: 'NotFound', message: 'Handover tidak ditemukan' };
      h.status = 'OPEN';
      await h.save();
      const full = await findHandover(h.id, req);
      res.json(full);
    } catch (err) { next(err); }
  }

  static async addResi(req, res, next) {
    try {
      const h = await Handover.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!h) throw { name: 'NotFound', message: 'Handover tidak ditemukan' };
      if (h.status === 'CLOSED') throw { name: 'ValidationError', message: 'Sesi handover sudah ditutup, tidak bisa menambah resi' };

      const { resi } = req.body;
      if (!resi?.trim()) throw { name: 'ValidationError', message: 'Nomor resi wajib diisi' };

      const resiClean = resi.trim().toUpperCase();

      const existing = await Handover_Item.findOne({
        where: { HandoverId: h.id, resi: resiClean },
      });
      if (existing) throw { name: 'ValidationError', message: `Resi ${resiClean} sudah ada dalam dokumen ini` };

      const item = await Handover_Item.create({
        HandoverId: h.id,
        resi: resiClean,
        scannedAt: new Date(),
        companyId: companyId(req),
      });
      res.status(201).json(item);
    } catch (err) { next(err); }
  }

  static async removeResi(req, res, next) {
    try {
      const item = await Handover_Item.findOne({
        where: { id: req.params.itemId, HandoverId: req.params.id },
      });
      if (!item) throw { name: 'NotFound', message: 'Item tidak ditemukan' };
      await item.destroy();
      res.json({ message: 'Resi dihapus' });
    } catch (err) { next(err); }
  }

  static async serveAttachment(req, res, next) {
    try {
      const h = await Handover.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!h) throw { name: 'NotFound', message: 'Handover tidak ditemukan' };
      if (!h.attachment_url) throw { name: 'NotFound', message: 'Tidak ada lampiran' };

      const url = h.attachment_url;

      if (url.startsWith('http')) {
        const fetch = (targetUrl, hops = 0) => {
          if (hops > 5) return next(new Error('Too many redirects'));
          const client = targetUrl.startsWith('https') ? https : http;
          client.get(targetUrl, (upstream) => {
            // Follow redirects
            if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
              upstream.resume();
              return fetch(upstream.headers.location, hops + 1);
            }
            if (upstream.statusCode !== 200) {
              upstream.resume();
              return next({ name: 'NotFound', message: 'File tidak dapat diakses dari storage' });
            }
            const ct = upstream.headers['content-type'] || 'application/octet-stream';
            res.set('Content-Type', ct);
            res.set('Content-Disposition', 'inline');
            res.set('Cache-Control', 'private, max-age=3600');
            upstream.pipe(res);
          }).on('error', next);
        };
        fetch(url);
      } else {
        const filePath = path.join(__dirname, '..', url.replace(/^\//, ''));
        const ext = path.extname(filePath).toLowerCase();
        res.set('Content-Type', MIME[ext] || 'application/octet-stream');
        res.set('Content-Disposition', 'inline');
        res.set('Cache-Control', 'private, max-age=3600');
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) { next(err); }
  }

  static async uploadAttachment(req, res, next) {
    try {
      const h = await Handover.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!h) throw { name: 'NotFound', message: 'Handover tidak ditemukan' };
      if (!req.file) throw { name: 'ValidationError', message: 'File tidak ditemukan' };

      // Remove old attachment if exists
      if (h.attachment_url) await destroyHandoverAttachment(h.attachment_url);

      // Cloudinary returns secure_url; disk storage returns a local path
      const url = req.file.path ?? `/uploads/handovers/${req.file.filename}`;
      h.attachment_url = url;
      await h.save();

      const full = await findHandover(h.id, req);
      res.json(full);
    } catch (err) { next(err); }
  }

  static async deleteAttachment(req, res, next) {
    try {
      const h = await Handover.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!h) throw { name: 'NotFound', message: 'Handover tidak ditemukan' };

      if (h.attachment_url) await destroyHandoverAttachment(h.attachment_url);
      h.attachment_url = null;
      await h.save();

      const full = await findHandover(h.id, req);
      res.json(full);
    } catch (err) { next(err); }
  }
}

module.exports = HandoverController;
