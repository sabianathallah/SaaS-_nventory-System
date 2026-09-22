'use strict';
const { Permission } = require('../models');
const { ALL_PERMISSIONS } = require('../helpers/permissions');

// Build metadata map from helpers (parent, isParent, desc are not stored in DB)
const META = Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, {
  parent:   p.parent   ?? null,
  isParent: p.isParent ?? false,
  desc:     p.desc     ?? '',
}]));

class PermissionController {
  static async getAll(req, res, next) {
    try {
      const perms = await Permission.findAll({ order: [['group', 'ASC'], ['key', 'ASC']] });
      res.json(perms.map(p => ({
        key:      p.key,
        label:    p.label,
        group:    p.group,
        parent:   META[p.key]?.parent   ?? null,
        isParent: META[p.key]?.isParent ?? false,
        desc:     META[p.key]?.desc     ?? '',
      })));
    } catch (err) { next(err); }
  }
}

module.exports = PermissionController;
