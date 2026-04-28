'use strict';
const { RolePermission } = require('../models');
const { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, EDITABLE_ROLES } = require('../helpers/permissions');

function resolveCompanyId(req) {
  if (req.user.role === 'SUPER_ADMIN') {
    return req.query.companyId ? parseInt(req.query.companyId) : null;
  }
  return req.user.companyId ?? null;
}

class RolePermissionController {
  static async getAll(req, res, next) {
    try {
      const cid = resolveCompanyId(req);
      const rows = await RolePermission.findAll({ where: { companyId: cid } });

      const result = {};
      for (const role of EDITABLE_ROLES) {
        const found = rows.find(r => r.role === role);
        result[role] = found ? found.permissions : (DEFAULT_PERMISSIONS[role] ?? []);
      }

      res.json({ permissions: result, allPermissions: ALL_PERMISSIONS });
    } catch (err) { next(err); }
  }

  static async update(req, res, next) {
    try {
      const { role } = req.params;
      const { permissions } = req.body;

      if (!EDITABLE_ROLES.includes(role)) {
        return res.status(400).json({ message: `Role "${role}" tidak dapat diedit` });
      }
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: 'permissions harus berupa array' });
      }

      const validKeys = new Set(ALL_PERMISSIONS.map(p => p.key));
      const filtered = permissions.filter(p => validKeys.has(p));

      const cid = resolveCompanyId(req);

      const [record, created] = await RolePermission.findOrCreate({
        where: { role, companyId: cid },
        defaults: { role, permissions: filtered, companyId: cid },
      });
      if (!created) {
        await record.update({ permissions: filtered });
      }

      res.json({ role, permissions: filtered });
    } catch (err) { next(err); }
  }

  static async resetToDefault(req, res, next) {
    try {
      const { role } = req.params;
      if (!EDITABLE_ROLES.includes(role)) {
        return res.status(400).json({ message: `Role "${role}" tidak dapat direset` });
      }
      const cid = resolveCompanyId(req);
      await RolePermission.destroy({ where: { role, companyId: cid } });
      res.json({ role, permissions: DEFAULT_PERMISSIONS[role] ?? [] });
    } catch (err) { next(err); }
  }
}

module.exports = RolePermissionController;
