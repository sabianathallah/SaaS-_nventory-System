'use strict';
const { Op } = require('sequelize');
const { Attendance, LeaveRequest, OvertimeRequest, User, Shift, LeaveType } = require('../models');
const { companyFilter } = require('../helpers/tenancy');
const { buildFilter } = require('../helpers/queryHelper');

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

            const leaves = await LeaveRequest.findAll({
                where: { ...companyFilter(req), status: 'APPROVED', ...(filter.userId ? { userId: filter.userId } : {}) },
                include: [{ model: User, as: 'user', attributes: USER_ATTRS }, { model: LeaveType, as: 'leaveType' }],
            });

            const overtimes = await OvertimeRequest.findAll({
                where: { ...companyFilter(req), status: 'APPROVED', ...(filter.userId ? { userId: filter.userId } : {}) },
                include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
            });

            const byStatus = {};
            attendances.forEach(a => { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });

            res.json({
                summary: {
                    totalAttendance: attendances.length,
                    byStatus,
                    totalLeaveApproved: leaves.length,
                    totalOvertimeApproved: overtimes.length,
                },
                attendances,
                leaves,
                overtimes,
            });
        } catch (err) { next(err); }
    }
}

module.exports = HrisReportController;
