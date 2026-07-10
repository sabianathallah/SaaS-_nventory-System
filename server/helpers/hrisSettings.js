'use strict';
const { companyFilter } = require('./tenancy');

const DEFAULT_MIN_WORK_MINUTES = 480; // 8 jam, termasuk istirahat
const DEFAULT_LATE_GRACE_MINUTES = 15;

// Setting jam kerja per company, dengan fallback ke default kalau admin belum
// pernah menyimpan setting.
async function getHrisSettings(req) {
  const { HrisSetting } = require('../models');
  const setting = await HrisSetting.findOne({ where: { ...companyFilter(req) } });
  return {
    minWorkMinutes:   setting?.minWorkMinutes   ?? DEFAULT_MIN_WORK_MINUTES,
    lateGraceMinutes: setting?.lateGraceMinutes ?? DEFAULT_LATE_GRACE_MINUTES,
  };
}

// 370 -> "6j 10m", 480 -> "8j", 45 -> "45m"
function fmtMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}j ${m}m`;
  if (h) return `${h}j`;
  return `${m}m`;
}

module.exports = { getHrisSettings, fmtMinutes, DEFAULT_MIN_WORK_MINUTES, DEFAULT_LATE_GRACE_MINUTES };
