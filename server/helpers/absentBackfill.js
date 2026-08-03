'use strict';
const { Op } = require('sequelize');
const { Attendance, User, LeaveRequest, WfaRequest, SickLeaveRequest } = require('../models');

// Dipakai bareng oleh endpoint manual (backfillAbsent, dipicu admin) dan
// cron job harian (autoMarkAbsentJob) — logic sama persis, cuma beda
// rentang tanggal & scope company-nya.
async function backfillAbsentForDates(dates, companyWhere = {}, editedBy = null) {
    if (!dates.length) return { created: 0, checkedUsers: 0, usersWithoutShift: [] };

    const [users, usersWithoutShift] = await Promise.all([
        User.findAll({
            where: { shiftId: { [Op.ne]: null }, isActive: true, ...companyWhere },
            attributes: ['id', 'companyId', 'shiftId'],
        }),
        // Diagnostik — karyawan aktif tanpa shift otomatis DI-SKIP dari
        // pengecekan absen, karena sistem gak tau jam kerja/hari kerjanya.
        User.findAll({
            where: { shiftId: null, isActive: true, ...companyWhere },
            attributes: ['id', 'name'],
        }),
    ]);
    const usersWithoutShiftPlain = usersWithoutShift.map(u => ({ id: u.id, name: u.name }));
    if (!users.length) {
        return { created: 0, checkedUsers: 0, usersWithoutShift: usersWithoutShiftPlain };
    }

    const userIds = users.map(u => u.id);
    const range = { [Op.between]: [dates[0], dates[dates.length - 1]] };

    const [existingAttendance, approvedLeaves, approvedWfa, approvedSick] = await Promise.all([
        Attendance.findAll({ where: { userId: userIds, date: range }, attributes: ['userId', 'date'] }),
        LeaveRequest.findAll({ where: { userId: userIds, status: 'APPROVED', startDate: { [Op.lte]: dates[dates.length - 1] }, endDate: { [Op.gte]: dates[0] } }, attributes: ['userId', 'startDate', 'endDate'] }),
        WfaRequest.findAll({ where: { userId: userIds, status: 'APPROVED', date: range }, attributes: ['userId', 'date'] }),
        SickLeaveRequest.findAll({ where: { userId: userIds, status: 'APPROVED', date: range }, attributes: ['userId', 'date'] }),
    ]);

    const attendanceSet = new Set(existingAttendance.map(a => `${a.userId}_${a.date}`));
    const wfaSet = new Set(approvedWfa.map(w => `${w.userId}_${w.date}`));
    const sickSet = new Set(approvedSick.map(s => `${s.userId}_${s.date}`));
    const leaveByUser = new Map();
    approvedLeaves.forEach(l => {
        if (!leaveByUser.has(l.userId)) leaveByUser.set(l.userId, []);
        leaveByUser.get(l.userId).push([l.startDate, l.endDate]);
    });
    const onApprovedLeave = (userId, date) => (leaveByUser.get(userId) || []).some(([s, e]) => date >= s && date <= e);

    const toCreate = [];
    for (const user of users) {
        for (const date of dates) {
            const key = `${user.id}_${date}`;
            if (attendanceSet.has(key) || wfaSet.has(key) || sickSet.has(key)) continue;
            if (onApprovedLeave(user.id, date)) continue;
            toCreate.push({
                userId: user.id,
                date,
                shiftId: user.shiftId,
                status: 'ABSENT',
                workMode: 'ON_SITE',
                note: 'Dibuat otomatis oleh sistem — tidak ada presensi tercatat',
                editedBy,
                editedAt: editedBy ? new Date() : null,
                editReason: 'Ditandai otomatis: tidak check-in dan tidak ada cuti/WFA/izin sakit disetujui',
                companyId: user.companyId,
            });
        }
    }

    if (toCreate.length) await Attendance.bulkCreate(toCreate);

    return { created: toCreate.length, checkedUsers: users.length, usersWithoutShift: usersWithoutShiftPlain };
}

module.exports = { backfillAbsentForDates };
