'use strict';
const express = require('express');
const router = express.Router();

const requirePermission = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');
const { uploadSingle } = require('../helpers/cloudinary');
const AttendanceController = require('../controllers/attendanceController');
const LeaveController = require('../controllers/leaveController');
const OvertimeController = require('../controllers/overtimeController');
const ShiftController = require('../controllers/shiftController');
const OfficeLocationController = require('../controllers/officeLocationController');
const HrisReportController = require('../controllers/hrisReportController');
const WfaController = require('../controllers/wfaController');
const LateExcuseController = require('../controllers/lateExcuseController');

router.use(requirePermission('hris.view'));

// ── Attendance ───────────────────────────────────────────────────────────────
router.get('/attendance/today',   AttendanceController.today);
router.get('/attendance/summary', AttendanceController.summary);
router.get('/attendance/pending-review', requirePermission('hris.attendance.review'), AttendanceController.pendingReview);
router.get('/attendance/users',   requirePermission('hris.attendance.edit'), AttendanceController.companyUsers);
router.get('/attendance',         AttendanceController.list);
router.post('/attendance/check-in',  uploadSingle('photo', 'saas-inventory/attendance'), AttendanceController.checkIn);
router.post('/attendance/check-out', uploadSingle('photo', 'saas-inventory/attendance'), AttendanceController.checkOut);
router.post('/attendance',        requirePermission('hris.attendance.edit'), AttendanceController.adminCreate);
router.patch('/attendance/:id/review', requirePermission('hris.attendance.review'), AttendanceController.review);
router.patch('/attendance/:id/review-late', requirePermission('hris.attendance.review'), AttendanceController.reviewLate);
router.patch('/attendance/:id/late-reason', AttendanceController.submitLateReason);
router.patch('/attendance/:id', requirePermission('hris.attendance.edit'), AttendanceController.update);

// ── Izin Telat (pengajuan di muka, sebelum check-in) ──────────────────────────
router.get('/late-excuse',       LateExcuseController.list);
router.post('/late-excuse',      requireCompany, LateExcuseController.create);
router.patch('/late-excuse/:id/review', requirePermission('hris.attendance.review'), LateExcuseController.review);
router.patch('/late-excuse/:id/cancel', LateExcuseController.cancel);

// ── Leave ────────────────────────────────────────────────────────────────────
router.get('/leave-types',    LeaveController.listTypes);
router.post('/leave-types',   requirePermission('hris.manage'), requireCompany, LeaveController.createType);
router.put('/leave-types/:id', requirePermission('hris.manage'), LeaveController.updateType);
router.delete('/leave-types/:id', requirePermission('hris.manage'), LeaveController.deleteType);
router.get('/leave-balances', LeaveController.getBalances);
router.get('/leave-balances/admin', requirePermission('hris.manage'), LeaveController.listBalancesForAdmin);
router.put('/leave-balances/adjust', requirePermission('hris.manage'), LeaveController.adjustBalance);
router.get('/leave-requests', LeaveController.list);
router.post('/leave-requests', requireCompany, LeaveController.create);
router.patch('/leave-requests/:id/review', requirePermission('hris.leave.review'), LeaveController.review);
router.patch('/leave-requests/:id/cancel', LeaveController.cancel);

// ── Overtime ─────────────────────────────────────────────────────────────────
router.get('/overtime',            OvertimeController.list);
router.post('/overtime',           requireCompany, OvertimeController.create);
router.patch('/overtime/:id/review', requirePermission('hris.overtime.review'), OvertimeController.review);
router.patch('/overtime/:id/cancel', OvertimeController.cancel);

// ── Shifts ───────────────────────────────────────────────────────────────────
router.get('/shifts',        ShiftController.list);
router.post('/shifts',       requirePermission('hris.shift.manage'), requireCompany, ShiftController.create);
router.put('/shifts/:id',    requirePermission('hris.shift.manage'), ShiftController.update);
router.delete('/shifts/:id', requirePermission('hris.shift.manage'), ShiftController.destroy);
router.post('/shifts/assign', requirePermission('hris.shift.manage'), ShiftController.assign);
router.get('/shifts/users',   requirePermission('hris.shift.manage'), ShiftController.listUsers);

// ── Office Locations ─────────────────────────────────────────────────────────
router.get('/office-locations',        OfficeLocationController.list);
router.post('/office-locations',       requirePermission('hris.location.manage'), requireCompany, OfficeLocationController.create);
router.put('/office-locations/:id',    requirePermission('hris.location.manage'), OfficeLocationController.update);
router.delete('/office-locations/:id', requirePermission('hris.location.manage'), OfficeLocationController.destroy);

// ── Reports ──────────────────────────────────────────────────────────────────
router.get('/reports/attendance', requirePermission('hris.reports.view'), HrisReportController.attendanceReport);

// ── WFA (Work From Anywhere) ──────────────────────────────────────────────────
router.get('/wfa/settings',       WfaController.getSettings);
router.put('/wfa/settings',       requirePermission('hris.manage'), WfaController.updateSettings);
router.get('/wfa/quota',          WfaController.getMyQuota);
router.get('/wfa/quota/admin',    requirePermission('hris.manage'), WfaController.listQuotasForAdmin);
router.put('/wfa/quota/adjust',   requirePermission('hris.manage'), WfaController.adjustQuota);
router.get('/wfa/requests',       WfaController.list);
router.post('/wfa/requests',      requireCompany, WfaController.create);
router.patch('/wfa/requests/:id/review', requirePermission('hris.leave.review'), WfaController.review);
router.patch('/wfa/requests/:id/cancel', WfaController.cancel);
router.get('/wfa/payment-adjustments', requirePermission('hris.reports.view'), WfaController.listPaymentAdjustments);

module.exports = router;
