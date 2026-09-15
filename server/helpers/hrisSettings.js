'use strict';
const { companyFilter } = require('./tenancy');

const DEFAULT_MIN_WORK_MINUTES = 480; // 8 jam, termasuk istirahat
const DEFAULT_LATE_GRACE_MINUTES = 15;
const DEFAULT_FIELD_PENDING_SCORE = 75; // skor sementara hari FIELD sebelum direview

// Default nilai skor leaderboard — semua bisa dioverride per company via GUI.
const DEFAULT_SCORES = {
  scoreOnTime: 100,     // datang <= jam mulai shift
  scoreLateTier1: 90,   // telat 1-29 menit
  scoreLateTier2: 85,   // telat 30-45 menit
  scoreLateTier3: 80,   // telat 46-60 menit
  scoreLateTier4: 75,   // telat > 60 menit
  lateExcuseBonus: 5,   // bonus di atas skor jam datang untuk izin telat approved
  scoreHalfDay: 50,     // setengah hari
  fieldPendingScore: DEFAULT_FIELD_PENDING_SCORE,
};

// Setting jam kerja per company, dengan fallback ke default kalau admin belum
// pernah menyimpan setting.
async function getHrisSettings(req) {
  const { HrisSetting } = require('../models');
  const setting = await HrisSetting.findOne({ where: { ...companyFilter(req) } });
  const result = {
    minWorkMinutes:   setting?.minWorkMinutes   ?? DEFAULT_MIN_WORK_MINUTES,
    lateGraceMinutes: setting?.lateGraceMinutes ?? DEFAULT_LATE_GRACE_MINUTES,
  };
  for (const [key, def] of Object.entries(DEFAULT_SCORES)) {
    result[key] = setting?.[key] ?? def;
  }
  return result;
}

// 370 -> "6j 10m", 480 -> "8j", 45 -> "45m"
function fmtMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}j ${m}m`;
  if (h) return `${h}j`;
  return `${m}m`;
}

module.exports = { getHrisSettings, fmtMinutes, DEFAULT_MIN_WORK_MINUTES, DEFAULT_LATE_GRACE_MINUTES, DEFAULT_FIELD_PENDING_SCORE, DEFAULT_SCORES };
