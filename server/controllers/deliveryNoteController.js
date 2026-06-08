'use strict';
const { DeliveryNote, VendorDelivery, Vendor, User } = require('../models');
const { destroyByUrl } = require('../helpers/cloudinary');

const INCLUDE = [
  { model: Vendor, as: 'Vendor', attributes: ['id', 'name'] },
  { model: User,   as: 'Creator', attributes: ['id', 'name'] },
  { model: VendorDelivery, as: 'delivery', attributes: ['id'] },
];

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await DeliveryNote.findAndCountAll({
      include: INCLUDE,
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
    });
    res.json({ data: rows, pagination: { total: count, page: Number(page), limit: Number(limit), totalPages: Math.ceil(count / Number(limit)) } });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await DeliveryNote.findByPk(req.params.id, { include: INCLUDE });
    if (!row) return res.status(404).json({ message: 'Surat Jalan tidak ditemukan' });
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { vendorId, date, notes } = req.body;
    if (!date) return res.status(400).json({ message: 'Tanggal wajib diisi' });
    const photoUrl = req.file?.path ?? null;
    const row = await DeliveryNote.create({
      vendorId: vendorId || null,
      date,
      photoUrl,
      notes: notes?.trim() || null,
      createdBy: req.user.id,
      companyId: req.user.companyId ?? null,
    });
    const result = await DeliveryNote.findByPk(row.id, { include: INCLUDE });
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const row = await DeliveryNote.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Surat Jalan tidak ditemukan' });
    const { vendorId, date, notes } = req.body;
    if (req.file?.path && row.photoUrl) await destroyByUrl(row.photoUrl);
    await row.update({
      vendorId:  vendorId !== undefined ? (vendorId || null) : row.vendorId,
      date:      date      || row.date,
      photoUrl:  req.file?.path ?? row.photoUrl,
      notes:     notes !== undefined ? (notes?.trim() || null) : row.notes,
    });
    const result = await DeliveryNote.findByPk(row.id, { include: INCLUDE });
    res.json({ data: result });
  } catch (err) { next(err); }
};

exports.destroy = async (req, res, next) => {
  try {
    const row = await DeliveryNote.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Surat Jalan tidak ditemukan' });
    if (row.photoUrl) await destroyByUrl(row.photoUrl);
    await row.destroy();
    res.json({ message: 'Surat Jalan dihapus' });
  } catch (err) { next(err); }
};
