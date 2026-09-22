'use strict';
const { sequelize, IncomingGoods, IncomingGoodsItem, SuratJalan, PackingJob, Vendor, Product, User } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { generateDocNumber } = require('../helpers/docNumber');

const PRODUCT_ATTRS  = ['id', 'name', 'sku', 'barcode', 'unit'];
const USER_ATTRS     = ['id', 'name'];
const VENDOR_ATTRS   = ['id', 'name', 'vendorCode'];

class IncomingGoodsController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                status:   'in',
                VendorId: 'exact',
                dateFrom: { field: 'receivedDate', type: 'gte' },
                dateTo:   { field: 'receivedDate', type: 'lte' },
            });
            const { rows, count } = await IncomingGoods.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                include: [
                    { model: Vendor, attributes: VENDOR_ATTRS },
                    { model: User, as: 'receivedByUser', attributes: USER_ATTRS },
                ],
                order: [['receivedDate', 'DESC'], ['createdAt', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const ig = await IncomingGoods.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [
                    { model: Vendor, attributes: VENDOR_ATTRS },
                    { model: User, as: 'receivedByUser', attributes: USER_ATTRS },
                    {
                        model: IncomingGoodsItem, as: 'items',
                        include: [{ model: Product, attributes: PRODUCT_ATTRS }],
                    },
                    { model: SuratJalan, as: 'suratJalan', attributes: ['id', 'sjNumber', 'generatedAt', 'printedAt'] },
                    {
                        model: PackingJob, as: 'packingJobs',
                        attributes: ['id', 'status', 'assignedTo', 'assignedAt'],
                        include: [{ model: User, as: 'assignedToUser', attributes: USER_ATTRS }],
                    },
                ],
            });
            if (!ig) throw { name: 'NotFound', message: 'IncomingGoods not found' };
            res.status(200).json(ig);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { items = [], ...headerData } = req.body;
            const cid = companyId(req);

            if (!items.length) {
                await t.rollback();
                return res.status(400).json({ message: 'Items tidak boleh kosong' });
            }

            for (const item of items) {
                if (!item.ProductId || item.qtyOrdered == null || item.qtyOrdered <= 0) {
                    await t.rollback();
                    return res.status(400).json({ message: 'Setiap item harus memiliki ProductId dan qtyOrdered > 0' });
                }
            }

            const docNumber = await generateDocNumber(IncomingGoods, 'docNumber', 'BM', cid ? { companyId: cid } : {});
            const totalQty = items.reduce((sum, i) => sum + (i.qtyReceived || 0), 0);

            const ig = await IncomingGoods.create({
                ...headerData,
                docNumber,
                receivedBy: req.user.id,
                status: 'DRAFT',
                totalItems: items.length,
                totalQty,
                companyId: cid,
            }, { transaction: t });

            const createdItems = await IncomingGoodsItem.bulkCreate(
                items.map(item => ({
                    ...item,
                    IncomingGoodsId: ig.id,
                    companyId: cid,
                })),
                { transaction: t, validate: true }
            );

            await t.commit();
            res.status(201).json({ ...ig.toJSON(), items: createdItems });
        } catch (err) { await t.rollback(); next(err); }
    }

    static async update(req, res, next) {
        try {
            const ig = await IncomingGoods.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!ig) throw { name: 'NotFound', message: 'IncomingGoods not found' };
            if (ig.status !== 'DRAFT') {
                return res.status(400).json({ message: 'Hanya dokumen berstatus DRAFT yang bisa diedit' });
            }
            const allowed = ['receivedDate', 'vendorDeliveryNote', 'notes'];
            const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
            await ig.update(updates);
            res.status(200).json(ig);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const ig = await IncomingGoods.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!ig) throw { name: 'NotFound', message: 'IncomingGoods not found' };
            if (ig.status !== 'DRAFT') {
                return res.status(400).json({ message: 'Hanya dokumen berstatus DRAFT yang bisa dihapus' });
            }
            await ig.destroy();
            res.status(200).json({ message: 'Dokumen dihapus' });
        } catch (err) { next(err); }
    }

    static async updateItem(req, res, next) {
        try {
            const ig = await IncomingGoods.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!ig) throw { name: 'NotFound', message: 'IncomingGoods not found' };
            if (ig.status !== 'DRAFT') {
                return res.status(400).json({ message: 'Hanya dokumen berstatus DRAFT yang bisa diedit' });
            }
            const item = await IncomingGoodsItem.findOne({
                where: { id: req.params.itemId, IncomingGoodsId: ig.id },
            });
            if (!item) throw { name: 'NotFound', message: 'Item not found' };

            const allowed = ['qtyOrdered', 'qtyReceived', 'notes'];
            const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
            await item.update(updates);

            const allItems = await IncomingGoodsItem.findAll({ where: { IncomingGoodsId: ig.id } });
            const totalQty = allItems.reduce((sum, i) => sum + (i.qtyReceived || 0), 0);
            await ig.update({ totalQty });

            res.status(200).json(item);
        } catch (err) { next(err); }
    }

    static async confirmVendor(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const ig = await IncomingGoods.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [
                    { model: IncomingGoodsItem, as: 'items', include: [{ model: Product, attributes: PRODUCT_ATTRS }] },
                ],
                transaction: t,
            });
            if (!ig) throw { name: 'NotFound', message: 'IncomingGoods not found' };
            if (ig.status !== 'DRAFT') {
                await t.rollback();
                return res.status(400).json({ message: 'Konfirmasi vendor hanya bisa dilakukan pada status DRAFT' });
            }

            const cid = companyId(req);
            const now = new Date();

            await ig.update({ status: 'VENDOR_CONFIRMED', vendorConfirmedAt: now, notes: req.body.notes || ig.notes }, { transaction: t });

            const snapshotItems = ig.items.map(i => ({
                productName: i.Product?.name || '',
                sku:         i.Product?.sku  || '',
                qtyReceived: i.qtyReceived,
                unit:        i.unit,
            }));

            const sjNumber = await generateDocNumber(SuratJalan, 'sjNumber', 'SJ', cid ? { companyId: cid } : {});
            const sj = await SuratJalan.create({
                sjNumber,
                IncomingGoodsId: ig.id,
                generatedBy: req.user.id,
                generatedAt: now,
                snapshotItems,
                notes: req.body.notes || null,
                companyId: cid,
            }, { transaction: t });

            await t.commit();
            res.status(200).json({
                message: 'Konfirmasi vendor berhasil',
                incomingGoods: ig,
                suratJalan: sj,
            });
        } catch (err) { await t.rollback(); next(err); }
    }

    static async notifyProduction(req, res, next) {
        try {
            const ig = await IncomingGoods.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!ig) throw { name: 'NotFound', message: 'IncomingGoods not found' };
            if (ig.status !== 'VENDOR_CONFIRMED') {
                return res.status(400).json({ message: 'Notifikasi produksi hanya bisa dilakukan pada status VENDOR_CONFIRMED' });
            }
            await ig.update({ status: 'PRODUCTION_NOTIFIED', productionNotifiedAt: new Date() });
            res.status(200).json({ message: 'Produksi berhasil dinotifikasi', incomingGoods: ig });
        } catch (err) { next(err); }
    }

    static async complete(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const ig = await IncomingGoods.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [
                    { model: IncomingGoodsItem, as: 'items' },
                    { model: PackingJob, as: 'packingJobs' },
                ],
                transaction: t,
            });
            if (!ig) throw { name: 'NotFound', message: 'IncomingGoods not found' };
            if (ig.status !== 'PACKING_IN_PROGRESS') {
                await t.rollback();
                return res.status(400).json({ message: 'Rekap akhir hanya bisa dilakukan pada status PACKING_IN_PROGRESS' });
            }

            const unverified = ig.packingJobs.filter(j => j.status !== 'VERIFIED');
            if (unverified.length) {
                await t.rollback();
                return res.status(400).json({ message: `Masih ada ${unverified.length} packing job yang belum diverifikasi` });
            }

            const { PackingResult } = require('../models');
            for (const item of ig.items) {
                const results = await PackingResult.findAll({
                    where: { IncomingGoodsItemId: item.id },
                    transaction: t,
                });
                const qtyReady  = results.reduce((s, r) => s + r.qtyReady,  0);
                const qtyReject = results.reduce((s, r) => s + r.qtyReject, 0);
                await item.update({ qtyReady, qtyReject }, { transaction: t });
            }

            await ig.update({ status: 'COMPLETED', completedAt: new Date() }, { transaction: t });
            await t.commit();

            await ig.reload({
                include: [{ model: IncomingGoodsItem, as: 'items', include: [{ model: Product, attributes: PRODUCT_ATTRS }] }],
            });

            const totalReady    = ig.items.reduce((s, i) => s + (i.qtyReady  || 0), 0);
            const totalReject   = ig.items.reduce((s, i) => s + (i.qtyReject || 0), 0);
            const totalReceived = ig.items.reduce((s, i) => s + i.qtyReceived, 0);

            res.status(200).json({
                message: 'Dokumen selesai',
                incomingGoods: ig,
                summary: { totalReady, totalReject, totalReceived },
            });
        } catch (err) { await t.rollback(); next(err); }
    }
}

module.exports = IncomingGoodsController;
