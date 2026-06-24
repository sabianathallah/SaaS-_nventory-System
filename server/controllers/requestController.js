'use strict';
const { Op } = require('sequelize');
const { Request, RequestItem, RequestType, ProductSKU, Product, ProductVariantOption, User } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, paginatedResponse } = require('../helpers/queryHelper');

const ITEM_INCLUDE = {
  model: RequestItem,
  as: 'items',
  include: [{
    model: ProductSKU,
    as: 'sku',
    attributes: ['id', 'sku_code', 'price', 'qty'],
    include: [
      { model: Product, attributes: ['id', 'name', 'imageUrl'] },
      { model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] } },
    ],
  }],
};

const BASE_INCLUDE = [
  { model: RequestType, as: 'requestType', attributes: ['id', 'name'] },
  { model: User, as: 'requestor', attributes: ['id', 'name', 'avatar'] },
  { model: User, as: 'processor', attributes: ['id', 'name'] },
];

function canViewAll(req) {
  const { role } = req.user;
  if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') return true;
  const perms = req.userPermissions ?? [];
  return perms.includes('request.view') || perms.includes('request.manage');
}

function canProcess(req) {
  const { role } = req.user;
  if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') return true;
  const perms = req.userPermissions ?? [];
  return perms.includes('request.process') || perms.includes('request.manage');
}

// Attach permissions to req for downstream use — called once per request
async function attachPermissions(req) {
  if (req.userPermissions) return;
  const { RolePermission, Role } = require('../models');
  const { Op: O } = require('sequelize');
  const roleRow = await Role.findOne({
    where: { name: req.user.role, [O.or]: [{ companyId: req.user.companyId }, { companyId: null }] },
    order: [['companyId', 'DESC NULLS LAST']],
  });
  if (!roleRow) { req.userPermissions = []; return; }
  const rps = await RolePermission.findAll({ where: { roleId: roleRow.id }, attributes: ['permissionKey'] });
  req.userPermissions = rps.map(r => r.permissionKey);
}

class RequestController {
  // GET /requests
  static async list(req, res, next) {
    try {
      await attachPermissions(req);
      const { page, limit, offset } = paginate(req.query);
      const where = { ...companyFilter(req) };

      if (!canViewAll(req)) where.requestorId = req.user.id;
      if (req.query.status)        where.status        = req.query.status;
      if (req.query.requestTypeId) where.requestTypeId = parseInt(req.query.requestTypeId);
      if (req.query.divisi)        where.divisi        = { [Op.iLike]: `%${req.query.divisi}%` };

      if (req.query.dateFrom || req.query.dateTo) {
        where.createdAt = {};
        if (req.query.dateFrom) where.createdAt[Op.gte] = new Date(req.query.dateFrom);
        if (req.query.dateTo)   where.createdAt[Op.lte] = new Date(req.query.dateTo + 'T23:59:59');
      }

      if (req.query.search) {
        where[Op.or] = [
          { recipientName: { [Op.iLike]: `%${req.query.search}%` } },
          { divisi:        { [Op.iLike]: `%${req.query.search}%` } },
        ];
      }

      const { rows, count } = await Request.findAndCountAll({
        where,
        include: BASE_INCLUDE,
        order: [['createdAt', 'DESC']],
        limit, offset, distinct: true,
      });
      res.json(paginatedResponse(rows, count, page, limit));
    } catch (err) { next(err); }
  }

  // GET /requests/export
  static async exportData(req, res, next) {
    try {
      await attachPermissions(req);
      const where = { ...companyFilter(req) };
      if (!canViewAll(req)) where.requestorId = req.user.id;
      if (req.query.status)        where.status        = req.query.status;
      if (req.query.requestTypeId) where.requestTypeId = parseInt(req.query.requestTypeId);
      if (req.query.dateFrom || req.query.dateTo) {
        where.createdAt = {};
        if (req.query.dateFrom) where.createdAt[Op.gte] = new Date(req.query.dateFrom);
        if (req.query.dateTo)   where.createdAt[Op.lte] = new Date(req.query.dateTo + 'T23:59:59');
      }

      const rows = await Request.findAll({
        where,
        include: [...BASE_INCLUDE, ITEM_INCLUDE],
        order: [['createdAt', 'DESC']],
      });
      res.json(rows);
    } catch (err) { next(err); }
  }

  // GET /requests/:id
  static async getById(req, res, next) {
    try {
      await attachPermissions(req);
      const where = { id: req.params.id, ...companyFilter(req) };
      if (!canViewAll(req)) where.requestorId = req.user.id;

      const request = await Request.findOne({
        where,
        include: [...BASE_INCLUDE, ITEM_INCLUDE],
      });
      if (!request) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
      res.json(request);
    } catch (err) { next(err); }
  }

  // POST /requests
  static async create(req, res, next) {
    try {
      const cid = companyId(req);
      const { requestTypeId, recipientName, recipientAddress, neededAt, note, needsReturn, divisi, items } = req.body;

      if (!requestTypeId)        return res.status(400).json({ message: 'Jenis pengajuan wajib dipilih' });
      if (!items?.length)        return res.status(400).json({ message: 'Minimal 1 produk wajib diisi' });

      const request = await Request.create({
        requestTypeId,
        requestorId: req.user.id,
        divisi: divisi || req.user.divisi || null,
        recipientName: recipientName || null,
        recipientAddress: recipientAddress || null,
        neededAt: neededAt || null,
        note: note || null,
        needsReturn: needsReturn === true || needsReturn === 'true',
        status: 'PENDING',
        companyId: cid,
      });

      for (const item of items) {
        await RequestItem.create({
          requestId:    request.id,
          ProductSKUId: item.ProductSKUId || null,
          productName:  item.productName,
          variantLabel: item.variantLabel || null,
          qty:          Number(item.qty) || 1,
          note:         item.note || null,
          companyId:    cid,
        });
      }

      const full = await Request.findByPk(request.id, { include: [...BASE_INCLUDE, ITEM_INCLUDE] });
      res.status(201).json(full);
    } catch (err) { next(err); }
  }

  // PUT /requests/:id  — edit only when PENDING and own (or request.process)
  static async update(req, res, next) {
    try {
      await attachPermissions(req);
      const request = await Request.findOne({
        where: { id: req.params.id, ...companyFilter(req) },
        include: [ITEM_INCLUDE],
      });
      if (!request) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });

      const isOwn = request.requestorId === req.user.id;
      if (!isOwn && !canProcess(req))  return res.status(403).json({ message: 'Forbidden' });
      if (request.status !== 'PENDING') return res.status(400).json({ message: 'Hanya pengajuan berstatus PENDING yang bisa diedit' });

      const { requestTypeId, recipientName, recipientAddress, neededAt, note, needsReturn, divisi, items } = req.body;
      await request.update({
        ...(requestTypeId    !== undefined && { requestTypeId }),
        ...(recipientName    !== undefined && { recipientName }),
        ...(recipientAddress !== undefined && { recipientAddress }),
        ...(neededAt         !== undefined && { neededAt }),
        ...(note             !== undefined && { note }),
        ...(needsReturn      !== undefined && { needsReturn: needsReturn === true || needsReturn === 'true' }),
        ...(divisi           !== undefined && { divisi }),
      });

      if (items) {
        await RequestItem.destroy({ where: { requestId: request.id } });
        for (const item of items) {
          await RequestItem.create({
            requestId:    request.id,
            ProductSKUId: item.ProductSKUId || null,
            productName:  item.productName,
            variantLabel: item.variantLabel || null,
            qty:          Number(item.qty) || 1,
            note:         item.note || null,
            companyId:    request.companyId,
          });
        }
      }

      const full = await Request.findByPk(request.id, { include: [...BASE_INCLUDE, ITEM_INCLUDE] });
      res.json(full);
    } catch (err) { next(err); }
  }

  // DELETE /requests/:id — PENDING only, own or request.process
  static async destroy(req, res, next) {
    try {
      await attachPermissions(req);
      const request = await Request.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!request) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });

      const isOwn = request.requestorId === req.user.id;
      if (!isOwn && !canProcess(req))    return res.status(403).json({ message: 'Forbidden' });
      if (request.status !== 'PENDING')  return res.status(400).json({ message: 'Hanya pengajuan PENDING yang bisa dihapus' });

      await request.destroy();
      res.json({ message: 'Pengajuan dihapus' });
    } catch (err) { next(err); }
  }

  // POST /requests/:id/approve
  static async approve(req, res, next) {
    try {
      await attachPermissions(req);
      if (!canProcess(req)) return res.status(403).json({ message: 'Forbidden: butuh request.process' });
      const request = await Request.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!request)                      return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
      if (request.status !== 'PENDING')  return res.status(400).json({ message: 'Hanya PENDING yang bisa di-approve' });
      await request.update({ status: 'APPROVED', processedBy: req.user.id });
      res.json(request);
    } catch (err) { next(err); }
  }

  // POST /requests/:id/reject
  static async reject(req, res, next) {
    try {
      await attachPermissions(req);
      if (!canProcess(req)) return res.status(403).json({ message: 'Forbidden: butuh request.process' });
      const request = await Request.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!request)                           return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
      if (!['PENDING','APPROVED'].includes(request.status)) return res.status(400).json({ message: 'Status tidak valid untuk reject' });
      await request.update({ status: 'REJECTED', processedBy: req.user.id, rejectionReason: req.body.reason || null });
      res.json(request);
    } catch (err) { next(err); }
  }

  // PATCH /requests/:id/sent
  static async markSent(req, res, next) {
    try {
      await attachPermissions(req);
      if (!canProcess(req)) return res.status(403).json({ message: 'Forbidden: butuh request.process' });
      const request = await Request.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!request)                      return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
      if (request.status !== 'APPROVED') return res.status(400).json({ message: 'Hanya APPROVED yang bisa ditandai dikirim' });
      await request.update({
        status: 'SENT',
        sentAt: req.body.sentAt || new Date().toISOString().slice(0, 10),
        trackingNumber: req.body.trackingNumber || null,
        processedBy: req.user.id,
      });
      res.json(request);
    } catch (err) { next(err); }
  }

  // PATCH /requests/:id/returned
  static async markReturned(req, res, next) {
    try {
      await attachPermissions(req);
      if (!canProcess(req)) return res.status(403).json({ message: 'Forbidden: butuh request.process' });
      const request = await Request.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!request)                   return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
      if (request.status !== 'SENT')  return res.status(400).json({ message: 'Hanya SENT yang bisa ditandai dikembalikan' });
      if (!request.needsReturn)       return res.status(400).json({ message: 'Pengajuan ini tidak memerlukan pengembalian' });
      await request.update({ returnedAt: req.body.returnedAt || new Date().toISOString().slice(0, 10) });
      res.json(request);
    } catch (err) { next(err); }
  }

  // PATCH /requests/:id/done
  static async markDone(req, res, next) {
    try {
      await attachPermissions(req);
      if (!canProcess(req)) return res.status(403).json({ message: 'Forbidden: butuh request.process' });
      const request = await Request.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!request)                  return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
      if (request.status !== 'SENT') return res.status(400).json({ message: 'Hanya SENT yang bisa ditandai selesai' });
      await request.update({ status: 'DONE', processedBy: req.user.id });
      res.json(request);
    } catch (err) { next(err); }
  }
}

module.exports = RequestController;
