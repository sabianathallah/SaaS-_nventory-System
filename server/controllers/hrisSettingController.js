'use strict';
const { HrisSetting } = require('../models');
const { companyId } = require('../helpers/tenancy');
const { getHrisSettings, DEFAULT_SCORES } = require('../helpers/hrisSettings');

class HrisSettingController {
  static async get(req, res, next) {
    try {
      res.json(await getHrisSettings(req));
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

      const scorePatch = {};
      for (const [key, def] of Object.entries(DEFAULT_SCORES)) {
        const value = Number(req.body[key] ?? def);
        if (!Number.isInteger(value) || value < 0 || value > 100) {
          throw { name: 'BadRequest', message: `Nilai skor ${key} harus 0–100` };
        }
        scorePatch[key] = value;
      }

      const cid = companyId(req);
      const [setting] = await HrisSetting.findOrCreate({
        where: { companyId: cid },
        defaults: { companyId: cid, minWorkMinutes, lateGraceMinutes, ...scorePatch },
      });
      await setting.update({ minWorkMinutes, lateGraceMinutes, ...scorePatch });
      res.json(await getHrisSettings(req));
    } catch (err) { next(err); }
  }
}

module.exports = HrisSettingController;
