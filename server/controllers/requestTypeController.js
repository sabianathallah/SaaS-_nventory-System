'use strict';
const { RequestType } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { Op, fn, col, where: sqWhere } = require('sequelize');

class RequestTypeController {
  static async list(req, res, next) {
    try {
      const types = await RequestType.findAll({
        where: { ...companyFilter(req), isActive: true },
        order: [['name', 'ASC']],
      });
      res.json(types);
    } catch (err) { next(err); }
  }

  static async create(req, res, next) {
    try {
      const { name, requiresShipping, shipmentType } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: 'Nama jenis wajib diisi' });
      const type = await RequestType.create({
        name: name.trim(),
        companyId: companyId(req),
        isActive: true,
        requiresShipping: requiresShipping === true || requiresShipping === 'true',
        shipmentType: shipmentType || null,
      });
      res.status(201).json(type);
    } catch (err) { next(err); }
  }

  // Buat jenis non-sales secara cepat dari form pengajuan — boleh semua user login.
  // Field lain dipaksa aman: shipmentType selalu 'non_sales', requiresShipping true.
  static async quickCreate(req, res, next) {
    try {
      const name = req.body.name?.trim();
      if (!name) return res.status(400).json({ message: 'Nama keperluan wajib diisi' });

      const existing = await RequestType.findOne({
        where: {
          ...companyFilter(req),
          shipmentType: 'non_sales',
          [Op.and]: [sqWhere(fn('LOWER', col('name')), name.toLowerCase())],
        },
      });
      if (existing) {
        if (!existing.isActive) await existing.update({ isActive: true });
        return res.json(existing);
      }

      const type = await RequestType.create({
        name,
        companyId: companyId(req),
        isActive: true,
        requiresShipping: true,
        shipmentType: 'non_sales',
      });
      res.status(201).json(type);
    } catch (err) { next(err); }
  }

  static async update(req, res, next) {
    try {
      const type = await RequestType.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!type) return res.status(404).json({ message: 'Jenis pengajuan tidak ditemukan' });
      const { name, requiresShipping, isActive, shipmentType } = req.body;
      await type.update({
        ...(name             !== undefined && { name: name.trim() }),
        ...(requiresShipping !== undefined && { requiresShipping: requiresShipping === true || requiresShipping === 'true' }),
        ...(isActive         !== undefined && { isActive }),
        ...(shipmentType     !== undefined && { shipmentType: shipmentType || null }),
      });
      res.json(type);
    } catch (err) { next(err); }
  }

  static async destroy(req, res, next) {
    try {
      const type = await RequestType.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!type) return res.status(404).json({ message: 'Jenis pengajuan tidak ditemukan' });
      await type.update({ isActive: false });
      res.json({ message: 'Jenis pengajuan dihapus' });
    } catch (err) { next(err); }
  }
}

module.exports = RequestTypeController;
