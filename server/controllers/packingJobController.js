'use strict';
const { sequelize, PackingJob, PackingResult, FormAnakPacking, IncomingGoods, IncomingGoodsItem, Product, User } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { generateDocNumber } = require('../helpers/docNumber');

const USER_ATTRS    = ['id', 'name'];
const PRODUCT_ATTRS = ['id', 'name', 'sku', 'barcode', 'unit'];

class PackingJobController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                status:          'exact',
                IncomingGoodsId: 'exact',
            });

            // TIM_PACKING hanya lihat job milik sendiri
            const selfFilter = req.user.role === 'TIM_PACKING' ? { assignedTo: req.user.id } : {};
            if (req.query.assignedTo) selfFilter.assignedTo = req.query.assignedTo;

            const { rows, count } = await PackingJob.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...selfFilter },
                include: [
                    { model: IncomingGoods, as: 'incomingGoods', attributes: ['id', 'docNumber', 'receivedDate'] },
                    { model: User, as: 'assignedToUser', attributes: USER_ATTRS },
                    { model: User, as: 'assignedByUser', attributes: USER_ATTRS },
                ],
                order: [['assignedAt', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const selfFilter = req.user.role === 'TIM_PACKING' ? { assignedTo: req.user.id } : {};
            const job = await PackingJob.findOne({
                where: { id: req.params.id, ...companyFilter(req), ...selfFilter },
                include: [
                    {
                        model: IncomingGoods, as: 'incomingGoods',
                        attributes: ['id', 'docNumber', 'receivedDate'],
                        include: [{
                            model: IncomingGoodsItem, as: 'items',
                            include: [{ model: Product, attributes: PRODUCT_ATTRS }],
                        }],
                    },
                    { model: User, as: 'assignedToUser',  attributes: USER_ATTRS },
                    { model: User, as: 'assignedByUser',  attributes: USER_ATTRS },
                    { model: User, as: 'verifiedByUser',  attributes: USER_ATTRS },
                    {
                        model: PackingResult, as: 'results',
                        include: [{
                            model: IncomingGoodsItem,
                            include: [{ model: Product, attributes: PRODUCT_ATTRS }],
                        }],
                    },
                ],
            });
            if (!job) throw { name: 'NotFound', message: 'Packing job not found' };
            res.status(200).json(job);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const { IncomingGoodsId, assignedTo, notes } = req.body;
            const cid = companyId(req);

            const ig = await IncomingGoods.findOne({ where: { id: IncomingGoodsId, ...companyFilter(req) } });
            if (!ig) throw { name: 'NotFound', message: 'IncomingGoods not found' };
            if (!['PRODUCTION_NOTIFIED', 'PACKING_IN_PROGRESS'].includes(ig.status)) {
                return res.status(400).json({ message: 'Packing job hanya bisa dibuat pada status PRODUCTION_NOTIFIED atau PACKING_IN_PROGRESS' });
            }

            const workerWhere = { id: assignedTo };
            if (cid) workerWhere.companyId = cid;
            const worker = await User.findOne({ where: workerWhere });
            if (!worker) throw { name: 'NotFound', message: 'Worker not found' };
            if (worker.role !== 'TIM_PACKING') {
                return res.status(400).json({ message: 'User yang diassign harus memiliki role TIM_PACKING' });
            }

            const job = await PackingJob.create({
                IncomingGoodsId,
                assignedTo,
                assignedBy: req.user.id,
                assignedAt: new Date(),
                status: 'PENDING',
                notes: notes || null,
                companyId: cid,
            });

            if (ig.status === 'PRODUCTION_NOTIFIED') {
                await ig.update({ status: 'PACKING_IN_PROGRESS' });
            }

            res.status(201).json(job);
        } catch (err) { next(err); }
    }

    static async start(req, res, next) {
        try {
            const selfFilter = req.user.role === 'TIM_PACKING' ? { assignedTo: req.user.id } : {};
            const job = await PackingJob.findOne({
                where: { id: req.params.id, ...companyFilter(req), ...selfFilter },
            });
            if (!job) throw { name: 'NotFound', message: 'Packing job not found' };
            if (!['PENDING', 'IN_PROGRESS'].includes(job.status)) {
                return res.status(400).json({ message: 'Job sudah tidak bisa dimulai' });
            }
            if (job.status === 'PENDING') {
                await job.update({ status: 'IN_PROGRESS', startedAt: new Date() });
            }
            res.status(200).json({ message: 'Job dimulai', startedAt: job.startedAt });
        } catch (err) { next(err); }
    }

    static async submit(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const selfFilter = req.user.role === 'TIM_PACKING' ? { assignedTo: req.user.id } : {};
            const job = await PackingJob.findOne({
                where: { id: req.params.id, ...companyFilter(req), ...selfFilter },
                transaction: t,
            });
            if (!job) throw { name: 'NotFound', message: 'Packing job not found' };
            if (!['PENDING', 'IN_PROGRESS'].includes(job.status)) {
                await t.rollback();
                return res.status(400).json({ message: 'Job tidak bisa disubmit, status saat ini: ' + job.status });
            }

            const { results = [] } = req.body;
            if (!results.length) {
                await t.rollback();
                return res.status(400).json({ message: 'Results tidak boleh kosong' });
            }

            for (const r of results) {
                if (r.qtyReject > 0 && !r.rejectReason) {
                    await t.rollback();
                    return res.status(400).json({ message: 'rejectReason wajib diisi jika qtyReject > 0' });
                }
                if ((r.qtyReady + r.qtyReject) === 0) {
                    await t.rollback();
                    return res.status(400).json({ message: 'qtyReady + qtyReject harus > 0 per item' });
                }
            }

            const cid = companyId(req);
            const createdResults = await PackingResult.bulkCreate(
                results.map(r => ({
                    PackingJobId: job.id,
                    IncomingGoodsItemId: r.IncomingGoodsItemId,
                    qtyReady:       r.qtyReady       || 0,
                    qtyReject:      r.qtyReject      || 0,
                    rejectReason:   r.rejectReason   || null,
                    scannedBarcode: r.scannedBarcode || null,
                    submittedBy:    req.user.id,
                    companyId:      cid,
                })),
                { transaction: t, validate: true }
            );

            await job.update({ status: 'SUBMITTED', submittedAt: new Date() }, { transaction: t });
            await t.commit();

            res.status(200).json({
                message: 'Hasil packing berhasil disubmit',
                packingJob: { id: job.id, status: job.status, submittedAt: job.submittedAt },
                results: createdResults,
            });
        } catch (err) { await t.rollback(); next(err); }
    }

    static async verify(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const job = await PackingJob.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [{
                    model: PackingResult, as: 'results',
                    include: [{ model: IncomingGoodsItem, include: [{ model: Product, attributes: ['name', 'sku'] }] }],
                }],
                transaction: t,
            });
            if (!job) throw { name: 'NotFound', message: 'Packing job not found' };
            if (job.status !== 'SUBMITTED') {
                await t.rollback();
                return res.status(400).json({ message: 'Verifikasi hanya bisa dilakukan pada job berstatus SUBMITTED' });
            }

            const now = new Date();
            const cid = companyId(req);

            await job.update({ status: 'VERIFIED', verifiedAt: now, verifiedBy: req.user.id, notes: req.body.notes || job.notes }, { transaction: t });

            // Build FormAnakPacking
            const totalQtyReady  = job.results.reduce((s, r) => s + r.qtyReady,  0);
            const totalQtyReject = job.results.reduce((s, r) => s + r.qtyReject, 0);
            const snapshotResults = job.results.map(r => ({
                productName:  r.IncomingGoodsItem?.Product?.name || '',
                sku:          r.IncomingGoodsItem?.Product?.sku  || '',
                qtyReady:     r.qtyReady,
                qtyReject:    r.qtyReject,
                rejectReason: r.rejectReason,
            }));

            const formNumber = await generateDocNumber(FormAnakPacking, 'formNumber', 'FAP', cid ? { companyId: cid } : {});
            const form = await FormAnakPacking.create({
                formNumber,
                PackingJobId:   job.id,
                workerId:       job.assignedTo,
                totalQtyPacked: totalQtyReady + totalQtyReject,
                totalQtyReady,
                totalQtyReject,
                snapshotResults,
                generatedBy: req.user.id,
                generatedAt: now,
                companyId:   cid,
            }, { transaction: t });

            await t.commit();
            res.status(200).json({
                message: 'Job diverifikasi',
                packingJob: { id: job.id, status: job.status, verifiedAt: job.verifiedAt },
                formAnakPacking: { id: form.id, formNumber: form.formNumber, generatedAt: form.generatedAt },
            });
        } catch (err) { await t.rollback(); next(err); }
    }

    static async getWorkers(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const where = { role: 'TIM_PACKING', isActive: true, ...companyFilter(req) };
            const { rows, count } = await User.findAndCountAll({
                where,
                attributes: ['id', 'name', 'email'],
                order: [['name', 'ASC']],
                limit, offset,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }
}

module.exports = PackingJobController;
