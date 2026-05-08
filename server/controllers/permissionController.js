'use strict';
const { Permission } = require('../models');

class PermissionController {
  static async getAll(req, res, next) {
    try {
      const perms = await Permission.findAll({ order: [['group', 'ASC'], ['key', 'ASC']] });
      res.json(perms.map(p => ({ key: p.key, label: p.label, group: p.group })));
    } catch (err) { next(err); }
  }
}

module.exports = PermissionController;
