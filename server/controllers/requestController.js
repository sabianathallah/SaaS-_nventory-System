'use strict';
const { Op } = require('sequelize');
const { sequelize, Request, RequestItem, RequestType, ProductSKU, Product, ProductVariantOption, User, ManualShipment, Stock_Out_Draft, Stock_Out_Draft_Item } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, paginatedResponse } = require('../helpers/queryHelper');

// Sales/Non-Sales pengajuan approval doesn't touch stock directly anymore — it
// stages a Stock Out Draft (prefilled from the request's items) so a human still
// has to physically pull and confirm the goods before anything leaves the
// warehouse. The Shipping Manual draft only gets created once that Stock Out is
// submitted — see stockOutDraftController.submit().
async function createStockOutDraftForRequest(request, cid, userId, t) {
  const draft = await Stock_Out_Draft.create({
    status: 'draft',
    note: `Dari Pengajuan #${request.id}${request.divisi ? ' — ' + request.divisi : ''}`,
    sourceRequestId: request.id,
    createdBy: userId,
    companyId: cid,
  }, { transaction: t });

  for (const item of request.items) {
    await Stock_Out_Draft_Item.create({
      DraftId: draft.id,
      ProductSKUId: item.ProductSKUId || null,
      ProductId: item.sku?.ProductId || null,
      quantity: item.qty,
      companyId: cid,
    }, { transaction: t });
  }
  return draft;
}

const ITEM_INCLUDE = {
  model: RequestItem,
  as: 'items',
  include: [{
    model: ProductSKU,
    as: 'sku',
    attributes: ['id', 'sku_code', 'price', 'qty', 'ProductId'],
    include: [
      { model: Product, attributes: ['id', 'name', 'imageUrl'] },
      { model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] } },
    ],
  }],
};

// Lightweight items for list view — no nested associations
const LIST_ITEM_INCLUDE = {
  model: RequestItem,
  as: 'items',
  attributes: ['id', 'productName', 'variantLabel', 'qty', 'shippedQty'],
};

const BASE_INCLUDE = [
  { model: RequestType,    as: 'requestType',   attributes: ['id', 'name', 'requiresShipping', 'shipmentType'] },
  { model: User,           as: 'requestor',     attributes: ['id', 'name', 'avatar'] },
  { model: User,           as: 'processor',     attributes: ['id', 'name'] },
  { model: User,           as: 'updater',       attributes: ['id', 'name'] },
  { model: ManualShipment, as: 'manualShipment', attributes: ['id', 'invoiceNumber', 'status'], required: false },
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

// Draft hanya terlihat oleh pembuatnya — approver tidak perlu lihat draft orang
// lain. Dipakai sebagai kondisi tambahan (Op.and) di list/counts/detail/export.
function draftVisibility(req) {
  return { [Op.or]: [{ status: { [Op.ne]: 'DRAFT' } }, { requestorId: req.user.id }] };
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
  // GET /requests/status-counts
  static async statusCounts(req, res, next) {
    try {
      await attachPermissions(req);
      const where = { ...companyFilter(req), [Op.and]: [draftVisibility(req)] };
      if (!canViewAll(req)) where.requestorId = req.user.id;

      const rows = await Request.findAll({
        where,
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['status'],
        raw: true,
      });

      const result = { DRAFT: 0, PENDING: 0, APPROVED: 0, SENT: 0, DONE: 0, REJECTED: 0, CANCELLED: 0 };
      for (const row of rows) {
        if (row.status in result) result[row.status] = parseInt(row.count, 10);
      }
      result.ALL = Object.values(result).reduce((a, b) => a + b, 0);
      res.json(result);
    } catch (err) { next(err); }
  }

  // GET /requests
  static async list(req, res, next) {
    try {
      await attachPermissions(req);
      const { page, limit, offset } = paginate(req.query);
      const where = { ...companyFilter(req), [Op.and]: [draftVisibility(req)] };

      if (!canViewAll(req)) where.requestorId = req.user.id;
      if (req.query.status)        where.status        = req.query.status;
      if (req.query.requestTypeId) where.requestTypeId = parseInt(req.query.requestTypeId);
      if (req.query.divisi)        where.divisi        = { [Op.iLike]: `%${req.query.divisi}%` };
      if (req.query.needsReturn !== undefined) where.needsReturn = req.query.needsReturn === 'true';

      if (req.query.dateFrom || req.query.dateTo) {
        where.createdAt = {};
        if (req.query.dateFrom) where.createdAt[Op.gte] = new Date(req.query.dateFrom);
        if (req.query.dateTo)   where.createdAt[Op.lte] = new Date(req.query.dateTo + 'T23:59:59');
      }

      if (req.query.search) {
        const term = sequelize.escape(`%${req.query.search}%`);
        where[Op.and].push({
          [Op.or]: [
            { recipientName: { [Op.iLike]: `%${req.query.search}%` } },
            { divisi:        { [Op.iLike]: `%${req.query.search}%` } },
            // Ikut cari nama produk di dalam item pengajuan
            sequelize.literal(`"Request"."id" IN (SELECT "requestId" FROM "RequestItems" WHERE "productName" ILIKE ${term})`),
          ],
        });
      }

      // Search khusus catatan — terpisah dari search umum supaya hasil pencarian
      // teks bebas di catatan tidak tercampur dengan nama penerima/produk.
      if (req.query.noteSearch) {
        const term = sequelize.escape(`%${req.query.noteSearch}%`);
        where[Op.and].push({
          [Op.or]: [
            { note: { [Op.iLike]: `%${req.query.noteSearch}%` } },
            sequelize.literal(`"Request"."id" IN (SELECT "requestId" FROM "RequestItems" WHERE "note" ILIKE ${term})`),
          ],
        });
      }

      const { rows, count } = await Request.findAndCountAll({
        where,
        include: [...BASE_INCLUDE, LIST_ITEM_INCLUDE],
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
      const where = { ...companyFilter(req), [Op.and]: [draftVisibility(req)] };
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
      const where = { id: req.params.id, ...companyFilter(req), [Op.and]: [draftVisibility(req)] };
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
      const { requestTypeId, shipmentType: directShipmentType, recipientName, recipientPhone, recipientAddress, neededAt, note, needsReturn, divisi, items, isDraft } = req.body;

      // Draft boleh disimpan tanpa produk — validasi minimal 1 produk baru
      // berlaku saat pengajuan benar-benar diajukan (create normal / submit).
      const asDraft = isDraft === true || isDraft === 'true';
      if (!asDraft && !items?.length) return res.status(400).json({ message: 'Minimal 1 produk wajib diisi' });

      // Resolve requestTypeId: bisa dari picker (non_sales) atau auto find-or-create (sales / stock_out)
      let rtId = requestTypeId ? Number(requestTypeId) : null;
      if (!rtId && directShipmentType) {
        const DEFAULT_NAMES = { sales: 'Early Access', stock_out: 'Jatah Internal', non_sales: 'Non-Sales' };
        const [rt] = await RequestType.findOrCreate({
          where: { companyId: cid, shipmentType: directShipmentType, isActive: true },
          defaults: {
            name:             DEFAULT_NAMES[directShipmentType] ?? directShipmentType,
            requiresShipping: directShipmentType === 'sales' || directShipmentType === 'non_sales',
            isActive:         true,
          },
        });
        rtId = rt.id;
      }
      if (!rtId) return res.status(400).json({ message: 'Jenis pengajuan wajib dipilih' });

      const request = await Request.create({
        requestTypeId: rtId,
        requestorId: req.user.id,
        divisi: divisi || req.user.divisi || null,
        recipientName: recipientName || null,
        recipientPhone: recipientPhone || null,
        recipientAddress: recipientAddress || null,
        neededAt: neededAt || null,
        note: note || null,
        needsReturn: needsReturn === true || needsReturn === 'true',
        status: asDraft ? 'DRAFT' : 'PENDING',
        companyId: cid,
      });

      for (const item of items ?? []) {
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

  // POST /requests/:id/submit — ajukan draft (DRAFT → PENDING), own or request.process
  static async submit(req, res, next) {
    try {
      await attachPermissions(req);
      const request = await Request.findOne({
        where: { id: req.params.id, ...companyFilter(req) },
        include: [ITEM_INCLUDE],
      });
      if (!request) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });

      const isOwn = request.requestorId === req.user.id;
      if (!isOwn && !canProcess(req))  return res.status(403).json({ message: 'Forbidden' });
      if (request.status !== 'DRAFT')  return res.status(400).json({ message: 'Hanya pengajuan berstatus DRAFT yang bisa diajukan' });
      if (!request.items?.length)      return res.status(400).json({ message: 'Minimal 1 produk wajib diisi sebelum diajukan' });

      await request.update({ status: 'PENDING', updatedBy: req.user.id });
      const full = await Request.findByPk(request.id, { include: [...BASE_INCLUDE, ITEM_INCLUDE] });
      res.json(full);
    } catch (err) { next(err); }
  }

  // PUT /requests/:id  — edit only when DRAFT/PENDING and own (or request.process)
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
      if (!['DRAFT', 'PENDING'].includes(request.status)) return res.status(400).json({ message: 'Hanya pengajuan berstatus DRAFT atau PENDING yang bisa diedit' });

      const { requestTypeId, recipientName, recipientPhone, recipientAddress, neededAt, note, needsReturn, divisi, items } = req.body;
      await request.update({
        ...(requestTypeId    !== undefined && { requestTypeId }),
        ...(recipientName    !== undefined && { recipientName }),
        ...(recipientPhone   !== undefined && { recipientPhone }),
        ...(recipientAddress !== undefined && { recipientAddress }),
        ...(neededAt         !== undefined && { neededAt }),
        ...(note             !== undefined && { note }),
        ...(needsReturn      !== undefined && { needsReturn: needsReturn === true || needsReturn === 'true' }),
        ...(divisi           !== undefined && { divisi }),
        updatedBy: req.user.id,
      });

      // Sinkronkan data penerima ke Shipping Manual tertaut (dua arah, seperti
      // nomor resi). Hanya saat shipment masih bisa diedit (draft/pending).
      if (recipientName !== undefined || recipientPhone !== undefined || recipientAddress !== undefined) {
        await ManualShipment.update({
          ...(recipientName    !== undefined && { recipientName }),
          ...(recipientPhone   !== undefined && { recipientPhone }),
          ...(recipientAddress !== undefined && { recipientAddress }),
          updatedBy: req.user.id,
        }, { where: { sourceRequestId: request.id, status: { [Op.in]: ['draft', 'pending'] } } });
      }

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

  // DELETE /requests/:id — DRAFT/PENDING only, own or request.process
  static async destroy(req, res, next) {
    try {
      await attachPermissions(req);
      const request = await Request.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!request) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });

      const isOwn = request.requestorId === req.user.id;
      if (!isOwn && !canProcess(req))    return res.status(403).json({ message: 'Forbidden' });
      if (!['DRAFT', 'PENDING'].includes(request.status)) return res.status(400).json({ message: 'Hanya pengajuan DRAFT atau PENDING yang bisa dihapus' });

      await request.destroy();
      res.json({ message: 'Pengajuan dihapus' });
    } catch (err) { next(err); }
  }

  // POST /requests/:id/approve
  static async approve(req, res, next) {
    try {
      await attachPermissions(req);
      if (!canProcess(req)) return res.status(403).json({ message: 'Forbidden: butuh request.process' });

      const request = await Request.findOne({
        where: { id: req.params.id, ...companyFilter(req) },
        include: [{ model: RequestType, as: 'requestType' }, ITEM_INCLUDE],
      });
      if (!request)                     return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
      if (request.status !== 'PENDING') return res.status(400).json({ message: 'Hanya PENDING yang bisa di-approve' });

      // Fallback: jika shipmentType belum diset tapi requiresShipping=true → non_sales
      const shipmentType = request.requestType?.shipmentType
        ?? (request.requestType?.requiresShipping ? 'non_sales' : null);
      const cid = companyId(req);

      // ── Jatah Internal / Sales / Non-Sales: auto-buat Stock Out Draft → APPROVED ──
      // Stok TIDAK langsung dipotong di sini — draft ini cuma daftar barang yang
      // perlu dikeluarkan. Stock Out-nya baru benar-benar mengurangi stok saat
      // disubmit (lihat stockOutDraftController.submit()). Untuk Jatah Internal,
      // submit itu langsung menyelesaikan request (status DONE) — tidak ada
      // Shipping Manual yang dibuat, beda dengan sales/non-sales.
      if (shipmentType === 'stock_out' || shipmentType === 'sales' || shipmentType === 'non_sales') {
        if (request.stockOutDraftId || request.manualShipmentId) {
          // Sudah pernah diproses (misal retry) — langsung approve saja
          await request.update({ status: 'APPROVED', processedBy: req.user.id, updatedBy: req.user.id });
        } else {
          const t = await sequelize.transaction();
          try {
            const draft = await createStockOutDraftForRequest(request, cid, req.user.id, t);
            await request.update({
              status:          'APPROVED',
              processedBy:     req.user.id,
              updatedBy:       req.user.id,
              stockOutDraftId: draft.id,
            }, { transaction: t });
            await t.commit();
          } catch (err) { await t.rollback(); throw err; }
        }

        const full = await Request.findByPk(request.id, { include: [...BASE_INCLUDE, ITEM_INCLUDE] });
        return res.json(full);
      }

      // ── Default: approve tanpa auto-action ───────────────────────────────────
      await request.update({ status: 'APPROVED', processedBy: req.user.id, updatedBy: req.user.id });
      const full = await Request.findByPk(request.id, { include: [...BASE_INCLUDE, ITEM_INCLUDE] });
      res.json(full);
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
      await request.update({ status: 'REJECTED', processedBy: req.user.id, updatedBy: req.user.id, rejectionReason: req.body.reason || null });
      res.json(request);
    } catch (err) { next(err); }
  }

  // POST /requests/:id/cancel — APPROVED → CANCELLED. Dipakai saat pengajuan
  // sudah disetujui tapi batal dikirim (mis. kebutuhan berubah, salah approve).
  // Melepas draft Stock Out & Shipping Manual yang sudah kadung dibuat otomatis
  // saat approve — asal belum berjalan (SENT ke atas berarti stok sudah keluar,
  // tidak bisa dibatalkan dari sini). TIDAK ADA DATA YANG DIHAPUS — draft/shipment
  // hanya ditandai 'cancelled' dan dilepas linknya, tetap tersimpan sebagai riwayat.
  static async cancel(req, res, next) {
    const t = await sequelize.transaction();
    try {
      await attachPermissions(req);
      if (!canProcess(req)) { await t.rollback(); return res.status(403).json({ message: 'Forbidden: butuh request.process' }); }

      const request = await Request.findOne({
        where: { id: req.params.id, ...companyFilter(req) },
        transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!request) { await t.rollback(); return res.status(404).json({ message: 'Pengajuan tidak ditemukan' }); }
      if (request.status !== 'APPROVED') {
        await t.rollback();
        return res.status(400).json({ message: 'Hanya pengajuan berstatus Disetujui yang bisa dibatalkan' });
      }

      const reason = req.body.reason?.trim();
      if (!reason) { await t.rollback(); return res.status(400).json({ message: 'Alasan pembatalan wajib diisi' }); }

      if (request.manualShipmentId) {
        const shipment = await ManualShipment.findByPk(request.manualShipmentId, { transaction: t });
        if (shipment && ['shipped', 'completed'].includes(shipment.status)) {
          await t.rollback();
          return res.status(400).json({ message: 'Shipping sudah berjalan (dikirim/selesai) — tidak bisa dibatalkan dari pengajuan' });
        }
        if (shipment) {
          await shipment.update({
            status: 'cancelled',
            cancelledReason: `Pengajuan #${request.id} dibatalkan: ${reason}`,
            updatedBy: req.user.id,
            sourceRequestId: null,
          }, { transaction: t });
        }
      }

      // Draft Stock Out belum disubmit di titik ini — cukup ditandai cancelled &
      // dilepas linknya, TIDAK dihapus, supaya tetap ada sebagai riwayat.
      if (request.stockOutDraftId) {
        await Stock_Out_Draft.update({
          status: 'cancelled',
          note: sequelize.literal(`COALESCE(note, '') || ' — dibatalkan: ${reason.replace(/'/g, "''")}'`),
          sourceRequestId: null,
        }, { where: { id: request.stockOutDraftId }, transaction: t });
      }

      await request.update({
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: new Date().toISOString().slice(0, 10),
        manualShipmentId: null,
        stockOutDraftId: null,
        processedBy: req.user.id,
        updatedBy: req.user.id,
      }, { transaction: t });

      await t.commit();
      const full = await Request.findByPk(request.id, { include: [...BASE_INCLUDE, ITEM_INCLUDE] });
      res.json(full);
    } catch (err) { await t.rollback(); next(err); }
  }

  // PATCH /requests/:id/sent
  static async markSent(req, res, next) {
    try {
      await attachPermissions(req);
      if (!canProcess(req)) return res.status(403).json({ message: 'Forbidden: butuh request.process' });
      const request = await Request.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!request)                      return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
      if (request.status !== 'APPROVED') return res.status(400).json({ message: 'Hanya APPROVED yang bisa ditandai dikirim' });
      // Update shippedQty per item if provided, else default to full qty
      const sentItems = Array.isArray(req.body.items) ? req.body.items : [];
      const fullRequest = await Request.findByPk(request.id, { include: [ITEM_INCLUDE] });
      for (const item of fullRequest.items) {
        const override = sentItems.find(i => i.id === item.id);
        const shipped = override != null ? Math.max(0, Math.min(Number(override.shippedQty), item.qty)) : item.qty;
        await item.update({ shippedQty: shipped });
      }

      const trackingNumber = req.body.trackingNumber?.trim() || request.trackingNumber || null;
      await request.update({
        status: 'SENT',
        sentAt: req.body.sentAt || new Date().toISOString().slice(0, 10),
        trackingNumber,
        shippingNote: req.body.shippingNote || null,
        processedBy: req.user.id,
        updatedBy: req.user.id,
      });

      // Sinkronkan resi ke Shipping Manual yang dibuat dari pengajuan ini
      if (trackingNumber) {
        await ManualShipment.update(
          { courierResiNumber: trackingNumber, updatedBy: req.user.id },
          { where: { sourceRequestId: request.id, ...companyFilter(req) } },
        );
      }
      const updated = await Request.findByPk(request.id, { include: [...BASE_INCLUDE, ITEM_INCLUDE] });
      res.json(updated);
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
      await request.update({ returnedAt: req.body.returnedAt || new Date().toISOString().slice(0, 10), updatedBy: req.user.id });
      res.json(request);
    } catch (err) { next(err); }
  }

  // PATCH /requests/:id/ship-remaining — tandai semua item sisa sudah dikirim
  static async shipRemaining(req, res, next) {
    try {
      await attachPermissions(req);
      if (!canProcess(req)) return res.status(403).json({ message: 'Forbidden: butuh request.process' });
      const request = await Request.findOne({ where: { id: req.params.id, ...companyFilter(req) }, include: [ITEM_INCLUDE] });
      if (!request)                  return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
      if (request.status !== 'SENT') return res.status(400).json({ message: 'Hanya SENT yang bisa dilengkapi pengirimannya' });

      for (const item of request.items) {
        if (item.shippedQty === null || item.shippedQty < item.qty) {
          await item.update({ shippedQty: item.qty });
        }
      }

      const full = await Request.findByPk(request.id, { include: [...BASE_INCLUDE, ITEM_INCLUDE] });
      res.json(full);
    } catch (err) { next(err); }
  }

  // POST /requests/:id/process-shipment — buat draft ManualShipment dari Pengajuan
  static async processShipment(req, res, next) {
    try {
      await attachPermissions(req);
      if (!canProcess(req)) return res.status(403).json({ message: 'Forbidden: butuh request.process' });

      const request = await Request.findOne({
        where: { id: req.params.id, ...companyFilter(req) },
        include: [
          { model: RequestType, as: 'requestType' },
          ITEM_INCLUDE,
        ],
      });
      if (!request)                      return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
      if (request.status !== 'APPROVED') return res.status(400).json({ message: 'Pengajuan harus berstatus APPROVED' });
      const shipType = request.requestType?.shipmentType;
      if (!request.requestType?.requiresShipping && shipType !== 'sales' && shipType !== 'non_sales') {
        return res.status(400).json({ message: 'Jenis pengajuan ini tidak memerlukan shipping' });
      }
      if (request.stockOutDraftId) return res.status(400).json({ message: 'Stock Out sudah dibuat untuk pengajuan ini' });
      if (request.manualShipmentId) return res.status(400).json({ message: 'Shipping sudah dibuat untuk pengajuan ini' });

      const cid = companyId(req);
      const t   = await sequelize.transaction();

      try {
        const draft = await createStockOutDraftForRequest(request, cid, req.user.id, t);
        await request.update({ stockOutDraftId: draft.id }, { transaction: t });
        await t.commit();

        const full = await Request.findByPk(request.id, { include: [...BASE_INCLUDE, ITEM_INCLUDE] });
        res.status(201).json(full);
      } catch (err) {
        await t.rollback();
        throw err;
      }
    } catch (err) { next(err); }
  }

  // POST /requests/:id/direct-shipment — buat draft ManualShipment LANGSUNG dari
  // Pengajuan, tanpa lewat Stock Out. Untuk kondisi lapangan di mana barang harus
  // dikirim sekarang tapi belum sempat di-stock-in (stok sistem 0, Stock Out pasti
  // gagal). Stok TIDAK dipotong sama sekali — shipment ditandai skippedStockOut
  // supaya kelihatan di detail shipping bahwa pergerakan stoknya tidak tercatat.
  static async directShipment(req, res, next) {
    try {
      await attachPermissions(req);
      if (!canProcess(req)) return res.status(403).json({ message: 'Forbidden: butuh request.process' });

      const request = await Request.findOne({
        where: { id: req.params.id, ...companyFilter(req) },
        include: [{ model: RequestType, as: 'requestType' }, ITEM_INCLUDE],
      });
      if (!request)                      return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
      if (request.status !== 'APPROVED') return res.status(400).json({ message: 'Pengajuan harus berstatus APPROVED' });
      if (request.manualShipmentId)      return res.status(400).json({ message: 'Shipping sudah dibuat untuk pengajuan ini' });

      const shipType = request.requestType?.shipmentType
        ?? (request.requestType?.requiresShipping ? 'non_sales' : null);
      if (shipType !== 'sales' && shipType !== 'non_sales') {
        return res.status(400).json({ message: 'Jenis pengajuan ini tidak memerlukan shipping' });
      }

      const cid = companyId(req);
      const t   = await sequelize.transaction();
      try {
        // Buang draft Stock Out yang nyangkut dari approve() — jalur ini memang
        // sengaja melewatinya, jangan sisakan draft yatim di halaman Stock Out.
        if (request.stockOutDraftId) {
          await Stock_Out_Draft_Item.destroy({ where: { DraftId: request.stockOutDraftId }, transaction: t });
          await Stock_Out_Draft.destroy({ where: { id: request.stockOutDraftId }, transaction: t });
        }

        const { createShipmentFromRequest } = require('../helpers/shipmentFromRequest');
        const shipment = await createShipmentFromRequest(request, cid, req.user.id, t, { skippedStockOut: true });
        await request.update({
          manualShipmentId: shipment.id,
          stockOutDraftId:  null,
          processedBy:      req.user.id,
          updatedBy:        req.user.id,
        }, { transaction: t });
        await t.commit();

        const full = await Request.findByPk(request.id, { include: [...BASE_INCLUDE, ITEM_INCLUDE] });
        res.status(201).json(full);
      } catch (err) {
        await t.rollback();
        throw err;
      }
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
      if (request.needsReturn && !request.returnedAt)
        return res.status(400).json({ message: 'Barang harus ditandai dikembalikan terlebih dahulu sebelum diselesaikan' });

      const fullReq = await Request.findByPk(request.id, { include: [ITEM_INCLUDE] });
      const hasDebt = fullReq.items.some(i => i.shippedQty !== null && i.shippedQty < i.qty);
      if (hasDebt)
        return res.status(400).json({ message: 'Masih ada item yang belum sepenuhnya dikirim. Selesaikan pengiriman sisa terlebih dahulu.' });

      await request.update({ status: 'DONE', processedBy: req.user.id });
      res.json(request);
    } catch (err) { next(err); }
  }
}

module.exports = RequestController;
