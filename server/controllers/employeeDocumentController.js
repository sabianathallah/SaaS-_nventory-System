'use strict';
const { EmployeeDocument, User } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { userHasPermission } = require('../helpers/permCheck');
const { destroyUpload } = require('../helpers/cloudinary');

const USER_ATTRS = ['id', 'name', 'email', 'divisi', 'avatar'];
const DOC_TYPES = ['KTP', 'NPWP', 'CONTRACT', 'OTHER'];

// Dokumen Karyawan (KTP, NPWP, kontrak kerja, dll) — admin upload & kelola
// dokumen milik siapa pun (hris.document.manage), karyawan biasa cuma bisa
// lihat dokumen miliknya sendiri (read-only, tanpa permission khusus),
// mengikuti pola canViewAll di sickLeaveController.list.
class EmployeeDocumentController {
    // Daftar karyawan buat picker di admin page — dipisah dari
    // AttendanceController.companyUsers/ShiftController.listUsers karena
    // itu digembok permission lain (hris.attendance.edit/hris.shift.manage)
    // yang gak relevan buat orang yang cuma punya hris.document.manage.
    static async listEmployees(req, res, next) {
        try {
            const users = await User.findAll({
                where: { ...companyFilter(req), isActive: true },
                attributes: USER_ATTRS,
                order: [['name', 'ASC']],
            });
            res.json(users);
        } catch (err) { next(err); }
    }

    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { type: 'exact' });

            const canManage = await userHasPermission(req, 'hris.document.manage');
            const selfFilter = canManage && req.query.userId ? { userId: req.query.userId } : (canManage ? {} : { userId: req.user.id });

            const { rows, count } = await EmployeeDocument.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...selfFilter },
                include: [
                    { model: User, as: 'user', attributes: USER_ATTRS },
                    { model: User, as: 'uploader', attributes: USER_ATTRS },
                ],
                order: [['createdAt', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const { userId, type, title, expiryDate, note } = req.body;
            if (!userId) throw { name: 'BadRequest', message: 'Karyawan wajib dipilih' };
            if (!DOC_TYPES.includes(type)) throw { name: 'BadRequest', message: 'Jenis dokumen tidak valid' };
            if (!title || !title.trim()) throw { name: 'BadRequest', message: 'Judul dokumen wajib diisi' };
            if (!req.file) throw { name: 'BadRequest', message: 'File dokumen wajib diunggah' };

            const targetUser = await User.findOne({ where: { id: userId, ...companyFilter(req) } });
            if (!targetUser) throw { name: 'NotFound', message: 'Karyawan tidak ditemukan' };

            const doc = await EmployeeDocument.create({
                userId,
                uploadedBy: req.user.id,
                type,
                title: title.trim(),
                url: req.file.path,
                expiryDate: expiryDate || null,
                note: note || null,
                companyId: companyId(req) ?? req.user.companyId,
            });
            res.status(201).json(doc);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const doc = await EmployeeDocument.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!doc) throw { name: 'NotFound', message: 'Dokumen tidak ditemukan' };

            const { type, title, expiryDate, note } = req.body;
            if (type !== undefined && !DOC_TYPES.includes(type)) throw { name: 'BadRequest', message: 'Jenis dokumen tidak valid' };

            const patch = {};
            if (type !== undefined) patch.type = type;
            if (title !== undefined) patch.title = title.trim();
            if (note !== undefined) patch.note = note || null;
            if (expiryDate !== undefined) {
                patch.expiryDate = expiryDate || null;
                // Reset guard biar reminder jalan lagi kalau tanggal expiry berubah
                // (misal dokumen baru diperpanjang).
                patch.expiryReminderSentAt = null;
            }

            await doc.update(patch);
            res.json(doc);
        } catch (err) { next(err); }
    }

    static async replaceFile(req, res, next) {
        try {
            const doc = await EmployeeDocument.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!doc) throw { name: 'NotFound', message: 'Dokumen tidak ditemukan' };
            if (!req.file) throw { name: 'BadRequest', message: 'File dokumen wajib diunggah' };

            const oldUrl = doc.url;
            await doc.update({ url: req.file.path });
            await destroyUpload(oldUrl);
            res.json(doc);
        } catch (err) { next(err); }
    }

    static async destroy(req, res, next) {
        try {
            const doc = await EmployeeDocument.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!doc) throw { name: 'NotFound', message: 'Dokumen tidak ditemukan' };
            await destroyUpload(doc.url);
            await doc.destroy();
            res.json({ message: 'Dokumen dihapus' });
        } catch (err) { next(err); }
    }
}

module.exports = EmployeeDocumentController;
