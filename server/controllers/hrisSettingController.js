'use strict';
const { HrisSetting } = require('../models');
const { companyId } = require('../helpers/tenancy');
const { getHrisSettings } = require('../helpers/hrisSettings');

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

      const cid = companyId(req);
      const [setting] = await HrisSetting.findOrCreate({
        where: { companyId: cid },
        defaults: { companyId: cid, minWorkMinutes, lateGraceMinutes },
      });
      await setting.update({ minWorkMinutes, lateGraceMinutes });
      res.json({ minWorkMinutes: setting.minWorkMinutes, lateGraceMinutes: setting.lateGraceMinutes });
    } catch (err) { next(err); }
  }
}

module.exports = HrisSettingController;
