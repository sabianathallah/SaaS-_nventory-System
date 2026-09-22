'use strict';
const { HrisSetting, HrisSettingLog, User } = require('../models');
const { companyId, companyFilter } = require('../helpers/tenancy');
const {
  getHrisSettings, DEFAULT_SCORES, DEFAULT_PERCENTS, DEFAULT_THRESHOLDS,
  DEFAULT_DAY_LIMITS, SCORE_ORDER, MAX_SCORE, ALL_DEFAULTS,
} = require('../helpers/hrisSettings');

// Tiap grup punya satuan & batas sendiri: poin 0-MAX_SCORE, persen 0-100,
// batas menit 1-1440, batas hari 0-31.
const GROUPS = [
  { defaults: DEFAULT_SCORES,     min: 0, max: MAX_SCORE, label: 'Nilai poin' },
  { defaults: DEFAULT_PERCENTS,   min: 0, max: 100,       label: 'Persentase' },
  { defaults: DEFAULT_THRESHOLDS, min: 1, max: 24 * 60,   label: 'Batas menit' },
  { defaults: DEFAULT_DAY_LIMITS, min: 0, max: 31,        label: 'Batas hari' },
];

class HrisSettingController {
  static async get(req, res, next) {
    try {
      res.json(await getHrisSettings(req));
    } catch (err) { next(err); }
  }

  // Riwayat perubahan kebijakan poin — angka ini menilai orang, jadi harus
  // jelas siapa mengubah apa dan kapan.
  static async logs(req, res, next) {
    try {
      const logs = await HrisSettingLog.findAll({
        where: { ...companyFilter(req) },
        include: [{ model: User, as: 'changer', attributes: ['id', 'name'] }],
        order: [['createdAt', 'DESC']],
        limit: 20,
      });
      res.json(logs);
    } catch (err) { next(err); }
  }

  static async update(req, res, next) {
    try {
      const minWorkMinutes = Number(req.body.minWorkMinutes);
      const lateGraceMinutes = Number(req.body.lateGraceMinutes);
      if (!Number.isInteger(minWorkMinutes) || minWorkMinutes < 0 || minWorkMinutes > 24 * 60) {
        throw { name: 'BadRequest', message: 'Durasi kerja minimal harus 0–1440 menit' };
      }
      if (!Number.isInteger(lateGraceMinutes) || lateGraceMinutes < 0 || lateGraceMinutes > 24 * 60) {
        throw { name: 'BadRequest', message: 'Toleransi telat harus 0–1440 menit' };
      }

      const patch = { minWorkMinutes, lateGraceMinutes };
      for (const { defaults, min, max, label } of GROUPS) {
        for (const [key, def] of Object.entries(defaults)) {
          const value = Number(req.body[key] ?? def);
          if (!Number.isInteger(value) || value < min || value > max) {
            throw { name: 'BadRequest', message: `${label} ${key} harus ${min}–${max}` };
          }
          patch[key] = value;
        }
      }

      // Batas menit tiap tier wajib naik, kalau tidak ada tier yang mustahil kena.
      if (patch.lateTier1Max > patch.lateTier2Max || patch.lateTier2Max > patch.lateTier3Max) {
        throw { name: 'BadRequest', message: 'Batas menit telat harus urut naik: tier 1 ≤ tier 2 ≤ tier 3' };
      }
      if (patch.workShortTier1Max > patch.workShortTier2Max) {
        throw { name: 'BadRequest', message: 'Batas menit kekurangan jam kerja harus urut naik: tier 1 ≤ tier 2' };
      }

      // Poin wajib menurun: yang lebih disiplin tidak boleh dapat lebih sedikit.
      for (const keys of SCORE_ORDER) {
        for (let i = 1; i < keys.length; i++) {
          if (patch[keys[i - 1]] < patch[keys[i]]) {
            throw {
              name: 'BadRequest',
              message: `Poin ${keys[i - 1]} tidak boleh lebih kecil dari ${keys[i]} — yang lebih disiplin harus dapat poin lebih tinggi`,
            };
          }
        }
      }

      const cid = companyId(req);
      const [setting, created] = await HrisSetting.findOrCreate({
        where: { companyId: cid },
        defaults: { companyId: cid, ...patch },
      });

      // Catat hanya field yang benar-benar berubah, biar riwayatnya kebaca.
      // Saat baru dibuat, patokannya nilai default (sebelum ini company itu
      // memang jalan dengan default).
      const changes = {};
      const before = created ? { ...ALL_DEFAULTS } : setting;
      for (const [key, to] of Object.entries(patch)) {
        const from = before[key];
        if (from !== undefined && from !== to) changes[key] = { from, to };
      }

      await setting.update(patch);
      if (Object.keys(changes).length) {
        await HrisSettingLog.create({ companyId: cid, changedBy: req.user.id, changes });
      }
      res.json(await getHrisSettings(req));
    } catch (err) { next(err); }
  }
}

module.exports = HrisSettingController;
