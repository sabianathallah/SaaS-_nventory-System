'use strict';
const { RequestType } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');

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
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: 'Nama jenis wajib diisi' });
      const type = await RequestType.create({
        name: name.trim(),
        companyId: companyId(req),
        isActive: true,
      });
      res.status(201).json(type);
    } catch (err) { next(err); }
  }
}

module.exports = RequestTypeController;
