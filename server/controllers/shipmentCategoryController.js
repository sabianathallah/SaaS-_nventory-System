'use strict';
const { ShipmentCategory } = require('../models');
const { companyFilter, companyId: getCompanyId } = require('../helpers/tenancy');

exports.list = async (req, res, next) => {
  try {
    const rows = await ShipmentCategory.findAll({
      where: companyFilter(req),
      order: [['name', 'ASC']],
    });
    res.json({ data: rows });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Nama kategori wajib diisi' });

    const row = await ShipmentCategory.create({
      companyId: getCompanyId(req),
      name: name.trim(),
    });
    res.status(201).json({ data: row });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const row = await ShipmentCategory.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!row) return res.status(404).json({ message: 'Kategori tidak ditemukan' });

    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Nama kategori wajib diisi' });
    await row.update({ name: name.trim() });
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.destroy = async (req, res, next) => {
  try {
    const row = await ShipmentCategory.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!row) return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    await row.destroy();
    res.json({ message: 'Kategori dihapus' });
  } catch (err) { next(err); }
};
