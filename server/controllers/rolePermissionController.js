'use strict';
const { RolePermission } = require('../models');
const { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, EDITABLE_ROLES, SYSTEM_ROLES } = require('../helpers/permissions');

function resolveCompanyId(req) {
  if (req.user.role === 'SUPER_ADMIN') {
    return req.query.companyId ? parseInt(req.query.companyId) : null;
  }
  return req.user.companyId ?? null;
}

const ALL_SYSTEM = [...SYSTEM_ROLES, ...EDITABLE_ROLES];

class RolePermissionController {
  static async getAll(req, res, next) {
    try {
      const cid = resolveCompanyId(req);
      const rows = await RolePermission.findAll({ where: { companyId: cid } });

      const result = {};

      // System editable roles — use DB value if exists, otherwise default
      for (const role of EDITABLE_ROLES) {
        const found = rows.find(r => r.role === role);
        result[role] = found ? found.permissions : (DEFAULT_PERMISSIONS[role] ?? []);
      }

      // Custom roles — any DB row that is not a system role
      const customRows = rows.filter(r => !ALL_SYSTEM.includes(r.role));
      for (const row of customRows) {
        result[row.role] = row.permissions;
      }

      const roles = [
        ...EDITABLE_ROLES.map(key => ({ key, isCustom: false })),
        ...customRows.map(r => ({ key: r.role, isCustom: true })),
      ];

      res.json({ permissions: result, allPermissions: ALL_PERMISSIONS, roles });
    } catch (err) { next(err); }
  }

  static async createRole(req, res, next) {
    try {
      const { roleName, permissions = [] } = req.body;

      if (!roleName || !roleName.trim()) {
        return res.status(400).json({ message: 'roleName wajib diisi' });
      }

      const key = roleName.trim().toUpperCase().replace(/\s+/g, '_');

      if (ALL_SYSTEM.includes(key)) {
        return res.status(400).json({ message: `Role "${key}" sudah ada sebagai role sistem` });
      }

      const cid = resolveCompanyId(req);
      const existing = await RolePermission.findOne({ where: { role: key, companyId: cid } });
      if (existing) {
        return res.status(409).json({ message: `Role "${key}" sudah ada` });
      }

      const validKeys = new Set(ALL_PERMISSIONS.map(p => p.key));
      const filtered = permissions.filter(p => validKeys.has(p));

      await RolePermission.create({ role: key, permissions: filtered, companyId: cid });
      res.status(201).json({ role: key, permissions: filtered });
    } catch (err) { next(err); }
  }

  static async update(req, res, next) {
    try {
      const { role } = req.params;
      const { permissions } = req.body;

      if (SYSTEM_ROLES.includes(role)) {
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
      if (!created) await record.update({ permissions: filtered });

      res.json({ role, permissions: filtered });
    } catch (err) { next(err); }
  }

  static async deleteRole(req, res, next) {
    try {
      const { role } = req.params;

      if (SYSTEM_ROLES.includes(role)) {
        return res.status(400).json({ message: `Role "${role}" tidak dapat dihapus` });
      }

      const cid = resolveCompanyId(req);
      await RolePermission.destroy({ where: { role, companyId: cid } });

      if (EDITABLE_ROLES.includes(role)) {
        // System role → reset ke default
        res.json({ role, permissions: DEFAULT_PERMISSIONS[role] ?? [], reset: true });
      } else {
        // Custom role → benar-benar dihapus
        res.json({ role, deleted: true });
      }
    } catch (err) { next(err); }
  }
}

module.exports = RolePermissionController;
