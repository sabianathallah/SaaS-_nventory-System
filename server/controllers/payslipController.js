'use strict';
const { Payslip, User, SalaryProfile, Company } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { buildFilter, paginate, paginatedResponse } = require('../helpers/queryHelper');
const { userHasPermission } = require('../helpers/permCheck');
const { uploadBuffer, destroyByUrl } = require('../helpers/cloudinary');
const { renderPayslipPdf } = require('../helpers/payslipPdf');

const USER_ATTRS = ['id', 'name', 'email', 'divisi', 'nik'];
// pdfUrl sengaja TIDAK PERNAH ikut dikirim di response list/detail — file cuma
// bisa diambil lewat endpoint download yang terautentikasi (lihat download()),
// supaya link Cloudinary mentah nggak pernah bocor ke client.
const PAYSLIP_ATTRS = { exclude: ['pdfUrl'] };

function toNum(v) { return Number(v || 0); }

function computeTotals({ fixedSalary, allowanceTransport, allowanceMeal, overtime, bonus, otherDeductions }) {
    const totalEarnings = toNum(fixedSalary) + toNum(allowanceTransport) + toNum(allowanceMeal) + toNum(overtime) + toNum(bonus);
    const totalDeductions = toNum(otherDeductions);
    const netPay = totalEarnings - totalDeductions;
    return { totalEarnings, totalDeductions, netPay };
}

async function generateAndUploadPdf({ company, employee, payslipData }) {
    const buffer = await renderPayslipPdf({ company, employee, payslip: payslipData });
    const publicId = `payslip-${employee.id}-${payslipData.periodStart}-${Date.now()}`;
    return uploadBuffer(buffer, 'saas-inventory/payslips', publicId);
}

// Slip Gaji — admin generate DRAFT per karyawan per periode, cek dulu baru
// Publish supaya karyawan bisa lihat. Karyawan cuma bisa lihat slip gaji
// MILIK SENDIRI dan yang sudah PUBLISHED — data gaji itu sensitif, jadi
// scoping ini ketat, mengikuti pola self-vs-admin yang sudah ada di HRIS
// (sickLeaveController, lateExcuseController, dst).
class PayslipController {
    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { status: 'exact' });

            const canViewAll = await userHasPermission(req, 'hris.payslip.manage');
            const selfFilter = canViewAll && req.query.userId
                ? { userId: req.query.userId }
                : (canViewAll ? {} : { userId: req.user.id, status: 'PUBLISHED' });

            const { rows, count } = await Payslip.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...selfFilter },
                attributes: PAYSLIP_ATTRS,
                include: [
                    { model: User, as: 'user', attributes: USER_ATTRS },
                    { model: User, as: 'publisher', attributes: ['id', 'name'] },
                ],
                order: [['periodStart', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const canManage = await userHasPermission(req, 'hris.payslip.manage');
            if (!canManage) throw { name: 'Forbidden', message: 'Tidak diizinkan' };

            const { userId, periodStart, periodEnd, paymentDate, overtime, bonus, otherDeductions } = req.body;
            if (!userId || !periodStart || !periodEnd || !paymentDate) {
                throw { name: 'BadRequest', message: 'userId, periodStart, periodEnd, dan paymentDate wajib diisi' };
            }

            const employee = await User.findOne({ where: { id: userId, ...companyFilter(req) } });
            if (!employee) throw { name: 'NotFound', message: 'Karyawan tidak ditemukan' };

            const profile = await SalaryProfile.findOne({ where: { userId } });
            const fixedSalary = req.body.fixedSalary ?? profile?.fixedSalary ?? 0;
            const allowanceTransport = req.body.allowanceTransport ?? profile?.allowanceTransport ?? 0;
            const allowanceMeal = req.body.allowanceMeal ?? profile?.allowanceMeal ?? 0;

            const totals = computeTotals({ fixedSalary, allowanceTransport, allowanceMeal, overtime, bonus, otherDeductions });

            const company = await Company.findByPk(companyId(req) ?? employee.companyId);

            const payslipData = {
                periodStart, periodEnd, paymentDate,
                fixedSalary, allowanceTransport, allowanceMeal,
                overtime: toNum(overtime), bonus: toNum(bonus), otherDeductions: toNum(otherDeductions),
                ...totals,
            };
            const pdfUrl = await generateAndUploadPdf({ company: company || {}, employee, payslipData });

            const payslip = await Payslip.create({
                userId,
                ...payslipData,
                status: 'DRAFT',
                pdfUrl,
                createdBy: req.user.id,
                companyId: companyId(req) ?? employee.companyId,
            });

            const { pdfUrl: _omit, ...safePayslip } = payslip.toJSON();
            res.status(201).json(safePayslip);
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ message: 'Slip gaji untuk karyawan dan periode ini sudah ada' });
            }
            next(err);
        }
    }

    static async update(req, res, next) {
        try {
            const canManage = await userHasPermission(req, 'hris.payslip.manage');
            if (!canManage) throw { name: 'Forbidden', message: 'Tidak diizinkan' };

            const payslip = await Payslip.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!payslip) throw { name: 'NotFound', message: 'Slip gaji tidak ditemukan' };
            if (payslip.status !== 'DRAFT') throw { name: 'BadRequest', message: 'Hanya slip gaji berstatus DRAFT yang bisa diedit' };

            const employee = await User.findOne({ where: { id: payslip.userId, ...companyFilter(req) } });
            const company = await Company.findByPk(companyId(req) ?? employee.companyId);

            const fixedSalary = req.body.fixedSalary ?? payslip.fixedSalary;
            const allowanceTransport = req.body.allowanceTransport ?? payslip.allowanceTransport;
            const allowanceMeal = req.body.allowanceMeal ?? payslip.allowanceMeal;
            const overtime = req.body.overtime ?? payslip.overtime;
            const bonus = req.body.bonus ?? payslip.bonus;
            const otherDeductions = req.body.otherDeductions ?? payslip.otherDeductions;
            const periodStart = req.body.periodStart ?? payslip.periodStart;
            const periodEnd = req.body.periodEnd ?? payslip.periodEnd;
            const paymentDate = req.body.paymentDate ?? payslip.paymentDate;

            const totals = computeTotals({ fixedSalary, allowanceTransport, allowanceMeal, overtime, bonus, otherDeductions });
            const payslipData = { periodStart, periodEnd, paymentDate, fixedSalary, allowanceTransport, allowanceMeal, overtime: toNum(overtime), bonus: toNum(bonus), otherDeductions: toNum(otherDeductions), ...totals };

            const newPdfUrl = await generateAndUploadPdf({ company: company || {}, employee, payslipData });
            const oldPdfUrl = payslip.pdfUrl;

            await payslip.update({ ...payslipData, pdfUrl: newPdfUrl });
            if (oldPdfUrl) await destroyByUrl(oldPdfUrl);

            const { pdfUrl: _omit, ...safePayslip } = payslip.toJSON();
            res.json(safePayslip);
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ message: 'Slip gaji untuk karyawan dan periode ini sudah ada' });
            }
            next(err);
        }
    }

    static async publish(req, res, next) {
        try {
            const canManage = await userHasPermission(req, 'hris.payslip.manage');
            if (!canManage) throw { name: 'Forbidden', message: 'Tidak diizinkan' };

            const payslip = await Payslip.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!payslip) throw { name: 'NotFound', message: 'Slip gaji tidak ditemukan' };
            if (payslip.status !== 'DRAFT') throw { name: 'BadRequest', message: 'Slip gaji ini sudah dipublish' };

            await payslip.update({ status: 'PUBLISHED', publishedBy: req.user.id, publishedAt: new Date() });
            const { pdfUrl: _omit, ...safePayslip } = payslip.toJSON();
            res.json(safePayslip);
        } catch (err) { next(err); }
    }

    static async unpublish(req, res, next) {
        try {
            const canManage = await userHasPermission(req, 'hris.payslip.manage');
            if (!canManage) throw { name: 'Forbidden', message: 'Tidak diizinkan' };

            const payslip = await Payslip.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!payslip) throw { name: 'NotFound', message: 'Slip gaji tidak ditemukan' };
            if (payslip.status !== 'PUBLISHED') throw { name: 'BadRequest', message: 'Slip gaji ini belum dipublish' };

            await payslip.update({ status: 'DRAFT', publishedBy: null, publishedAt: null });
            const { pdfUrl: _omit, ...safePayslip } = payslip.toJSON();
            res.json(safePayslip);
        } catch (err) { next(err); }
    }

    static async destroy(req, res, next) {
        try {
            const canManage = await userHasPermission(req, 'hris.payslip.manage');
            if (!canManage) throw { name: 'Forbidden', message: 'Tidak diizinkan' };

            const payslip = await Payslip.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!payslip) throw { name: 'NotFound', message: 'Slip gaji tidak ditemukan' };
            if (payslip.status !== 'DRAFT') throw { name: 'BadRequest', message: 'Slip gaji yang sudah dipublish tidak bisa dihapus' };

            const pdfUrl = payslip.pdfUrl;
            await payslip.destroy();
            if (pdfUrl) await destroyByUrl(pdfUrl);
            res.status(204).send();
        } catch (err) { next(err); }
    }

    // Satu-satunya jalan buat dapetin file PDF-nya — selalu lewat sini biar
    // otorisasi (self+published, atau admin) selalu dicek ulang tiap request,
    // dan URL Cloudinary aslinya nggak pernah nyampe ke browser.
    static async download(req, res, next) {
        try {
            const payslip = await Payslip.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!payslip) throw { name: 'NotFound', message: 'Slip gaji tidak ditemukan' };

            const canViewAll = await userHasPermission(req, 'hris.payslip.manage');
            if (!canViewAll) {
                if (payslip.userId !== req.user.id) throw { name: 'Forbidden', message: 'Tidak diizinkan' };
                if (payslip.status !== 'PUBLISHED') throw { name: 'Forbidden', message: 'Slip gaji belum dipublish' };
            }
            if (!payslip.pdfUrl) throw { name: 'NotFound', message: 'File PDF belum tersedia' };

            const upstream = await fetch(payslip.pdfUrl);
            if (!upstream.ok) throw { name: 'NotFound', message: 'Gagal mengambil file PDF' };
            const buf = Buffer.from(await upstream.arrayBuffer());

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="slip-gaji-${payslip.periodStart}.pdf"`);
            res.send(buf);
        } catch (err) { next(err); }
    }
}

module.exports = PayslipController;
