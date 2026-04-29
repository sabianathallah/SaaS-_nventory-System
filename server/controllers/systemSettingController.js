'use strict';
const { SystemSetting } = require('../models');

const DEFAULT_VISIBILITY = {
  products:          true,
  catalog:           true,
  warehouses:        true,
  suppliers:         true,
  'stock-in':        true,
  'stock-out':       true,
  movements:         true,
  opname:            true,
  vendors:           true,
  'incoming-goods':  true,
  'surat-jalan':     true,
  'packing-jobs':    true,
  'form-anak-packing': true,
  users:             true,
  companies:         true,
};

class SystemSettingController {
  static async getPageVisibility(req, res, next) {
    try {
      const setting = await SystemSetting.findOne({ where: { key: 'page_visibility' } });
      res.json({ ...DEFAULT_VISIBILITY, ...(setting?.value ?? {}) });
    } catch (err) { next(err); }
  }

  static async updatePageVisibility(req, res, next) {
    try {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Forbidden: SUPER_ADMIN only' });
      }
      const merged = { ...DEFAULT_VISIBILITY, ...req.body };
      await SystemSetting.upsert({ key: 'page_visibility', value: merged });
      res.json(merged);
    } catch (err) { next(err); }
  }
}

module.exports = SystemSettingController;
