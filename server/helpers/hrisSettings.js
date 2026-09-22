'use strict';
const { companyFilter } = require('./tenancy');

const DEFAULT_MIN_WORK_MINUTES = 480; // 8 jam, termasuk istirahat
const DEFAULT_LATE_GRACE_MINUTES = 15;
const DEFAULT_FIELD_PENDING_SCORE = 75; // skor sementara hari FIELD sebelum direview

// Nilai poin leaderboard. Batas atas 200, bukan 100, supaya company yang mau
// memberi apresiasi (bukan cuma menghukum) bisa menaruh poin di atas nilai
// penuh — mis. lembur dihargai 110.
const MAX_SCORE = 200;

const DEFAULT_SCORES = {
  scoreOnTime: 100,     // datang <= jam mulai shift
  scoreLateTier1: 90,   // telat sampai lateTier1Max menit
  scoreLateTier2: 85,   // telat sampai lateTier2Max menit
  scoreLateTier3: 80,   // telat sampai lateTier3Max menit
  scoreLateTier4: 75,   // telat lebih dari lateTier3Max menit
  lateExcuseBonus: 5,   // bonus di atas skor jam datang untuk izin telat approved
  scoreHalfDay: 50,     // setengah hari
  fieldPendingScore: DEFAULT_FIELD_PENDING_SCORE,
  // Poin lama jam kerja, dibanding target durasi hari itu.
  scoreWorkOvertime: 100, // lebih dari target >= workOvertimeMinMinutes (default = sama
                          // dengan penuh, jadi tanpa apresiasi sampai admin menaikkannya)
  scoreWorkFull: 100,   // durasi kerja >= target
  scoreWorkTier1: 90,   // kurang sampai workShortTier1Max menit
  scoreWorkTier2: 80,   // kurang sampai workShortTier2Max menit
  scoreWorkTier3: 70,   // kurang lebih dari workShortTier2Max menit
};

// Poin tiap kelompok wajib menurun (yang lebih disiplin tidak boleh dapat
// lebih sedikit). Dipakai untuk validasi di controller.
const SCORE_ORDER = [
  ['scoreOnTime', 'scoreLateTier1', 'scoreLateTier2', 'scoreLateTier3', 'scoreLateTier4'],
  ['scoreWorkOvertime', 'scoreWorkFull', 'scoreWorkTier1', 'scoreWorkTier2', 'scoreWorkTier3'],
];

// Persentase (0-100).
const DEFAULT_PERCENTS = {
  // Porsi lama jam kerja di skor harian. 0 = skor murni jam datang (perilaku
  // lama), 100 = murni durasi kerja.
  workDurationWeight: 0,
};

// Batas menit tiap tier. Telat dihitung dari jam mulai shift; "kurang" dan
// "lebih" dihitung dari target durasi kerja hari itu.
const DEFAULT_THRESHOLDS = {
  lateTier1Max: 29,
  lateTier2Max: 45,
  lateTier3Max: 60,
  workShortTier1Max: 29,
  workShortTier2Max: 60,
  workOvertimeMinMinutes: 60,
};

// Batas dalam satuan hari (0-31).
const DEFAULT_DAY_LIMITS = {
  // Minimum hari terhitung untuk masuk leaderboard skor, supaya yang cuma
  // punya 2 hari data tidak mengalahkan yang konsisten sebulan. Dibatasi
  // otomatis ke jumlah hari kerja yang sudah lewat, biar awal bulan tetap
  // ada isinya.
  leaderboardMinDays: 10,
};

const ALL_DEFAULTS = { ...DEFAULT_SCORES, ...DEFAULT_PERCENTS, ...DEFAULT_THRESHOLDS, ...DEFAULT_DAY_LIMITS };

// Setting jam kerja, dengan fallback ke default kalau adminnya belum pernah
// menyimpan setting. `where` menentukan company-nya.
async function loadSettings(where) {
  const { HrisSetting } = require('../models');
  const setting = await HrisSetting.findOne({ where });
  const result = {
    minWorkMinutes:   setting?.minWorkMinutes   ?? DEFAULT_MIN_WORK_MINUTES,
    lateGraceMinutes: setting?.lateGraceMinutes ?? DEFAULT_LATE_GRACE_MINUTES,
  };
  for (const [key, def] of Object.entries(ALL_DEFAULTS)) {
    result[key] = setting?.[key] ?? def;
  }
  return result;
}

// Versi request-scoped, dipakai controller.
async function getHrisSettings(req) {
  return loadSettings({ ...companyFilter(req) });
}

// Versi tanpa request, dipakai cron job yang jalan lintas company.
async function getHrisSettingsByCompany(cid) {
  return loadSettings({ companyId: cid });
}

// 370 -> "6j 10m", 480 -> "8j", 45 -> "45m"
function fmtMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}j ${m}m`;
  if (h) return `${h}j`;
  return `${m}m`;
}

module.exports = {
  getHrisSettings, getHrisSettingsByCompany, fmtMinutes,
  DEFAULT_MIN_WORK_MINUTES, DEFAULT_LATE_GRACE_MINUTES, DEFAULT_FIELD_PENDING_SCORE,
  DEFAULT_SCORES, DEFAULT_PERCENTS, DEFAULT_THRESHOLDS, DEFAULT_DAY_LIMITS,
  ALL_DEFAULTS, SCORE_ORDER, MAX_SCORE,
};
