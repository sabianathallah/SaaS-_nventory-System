'use strict';
const { Op } = require('sequelize');
const { Attendance, LeaveRequest, OvertimeRequest, User, Shift, LeaveType } = require('../models');
const { companyFilter } = require('../helpers/tenancy');
const { buildFilter } = require('../helpers/queryHelper');
const { lateSeverity } = require('../helpers/lateSeverity');

const USER_ATTRS = ['id', 'name', 'email', 'divisi'];

class HrisReportController {
    static async attendanceReport(req, res, next) {
        try {
            const filter = buildFilter(req.query, {
                dateFrom: { field: 'date', type: 'gte' },
                dateTo:   { field: 'date', type: 'lte' },
                userId:   'exact',
            });

            const attendances = await Attendance.findAll({
                where: { ...companyFilter(req), ...filter },
                include: [
                    { model: User, as: 'user', attributes: USER_ATTRS },
                    { model: Shift, as: 'shift' },
                ],
                order: [['date', 'DESC']],
            });

            const { dateFrom, dateTo, userId } = req.query;

            // Cuti dianggap masuk rentang laporan kalau periodenya overlap sama
            // dateFrom/dateTo (bukan cuma yang persis dimulai di rentang itu).
            const leaveWhere = { ...companyFilter(req), status: 'APPROVED', ...(userId ? { userId } : {}) };
            if (dateFrom) leaveWhere.endDate   = { ...(leaveWhere.endDate   || {}), [Op.gte]: dateFrom };
            if (dateTo)   leaveWhere.startDate = { ...(leaveWhere.startDate || {}), [Op.lte]: dateTo };

            const overtimeWhere = { ...companyFilter(req), status: 'APPROVED', ...(userId ? { userId } : {}) };
            if (dateFrom) overtimeWhere.date = { ...(overtimeWhere.date || {}), [Op.gte]: dateFrom };
            if (dateTo)   overtimeWhere.date = { ...(overtimeWhere.date || {}), [Op.lte]: dateTo };

            const leaves = await LeaveRequest.findAll({
                where: leaveWhere,
                include: [{ model: User, as: 'user', attributes: USER_ATTRS }, { model: LeaveType, as: 'leaveType' }],
            });

            const overtimes = await OvertimeRequest.findAll({
                where: overtimeWhere,
                include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
            });

            const byStatus = {};
            attendances.forEach(a => { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });

            const attendancesWithSeverity = attendances.map(a => {
                const plain = a.toJSON();
                plain.lateSeverity = plain.status === 'LATE' ? lateSeverity(plain.checkInAt, plain.shift?.startTime) : null;
                return plain;
            });

            res.json({
                summary: {
                    totalAttendance: attendances.length,
                    byStatus,
                    totalLeaveApproved: leaves.length,
                    totalOvertimeApproved: overtimes.length,
                },
                attendances: attendancesWithSeverity,
                leaves,
                overtimes,
            });
        } catch (err) { next(err); }
    }
}

module.exports = HrisReportController;
