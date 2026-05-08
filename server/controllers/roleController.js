'use strict';
const { Role, RolePermission, sequelize } = require('../models');
const { Op } = require('sequelize');
const { SYSTEM_ROLES } = require('../helpers/permissions');

function resolveCompanyId(req) {
  if (req.user.role === 'SUPER_ADMIN') {
    return req.query.companyId ? parseInt(req.query.companyId) : null;
  }
  return req.user.companyId ?? null;
}

class RoleController {
  // GET /roles — list all roles visible to this company
  static async getAll(req, res, next) {
    try {
      const cid = resolveCompanyId(req);

      // Fetch global roles (companyId=null) + company-specific roles
      const roles = await Role.findAll({
        where: {
          [Op.or]: [
            { companyId: null },
            ...(cid ? [{ companyId: cid }] : []),
          ],
        },
        include: [{ model: RolePermission, as: 'rolePermissions', attributes: ['permissionKey'] }],
        order: [['isSystem', 'DESC'], ['name', 'ASC']],
      });

      res.json(roles.map(r => ({
        id:          r.id,
        name:        r.name,
        displayName: r.displayName,
        companyId:   r.companyId,
        isSystem:    r.isSystem,
        permissions: r.rolePermissions.map(rp => rp.permissionKey),
      })));
    } catch (err) { next(err); }
  }

  // POST /roles
  static async create(req, res, next) {
    try {
      const { name, displayName, permissions = [] } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: 'name wajib diisi' });

      const key = name.trim().toUpperCase().replace(/\s+/g, '_');
      if (SYSTEM_ROLES.includes(key)) return res.status(400).json({ message: `"${key}" adalah role sistem dan tidak bisa dibuat ulang` });

      const cid = resolveCompanyId(req);
      const exists = await Role.findOne({ where: { name: key, companyId: cid } });
      if (exists) return res.status(409).json({ message: `Role "${key}" sudah ada` });

      const role = await Role.create({
        name: key,
        displayName: displayName?.trim() || key,
        companyId: cid,
        isSystem: false,
      });

      if (permissions.length) {
        await RolePermission.bulkCreate(
          permissions.map(permissionKey => ({ roleId: role.id, permissionKey })),
          { ignoreDuplicates: true }
        );
      }

      res.status(201).json({ id: role.id, name: role.name, displayName: role.displayName, permissions });
    } catch (err) { next(err); }
  }

  // PUT /roles/:id — update displayName + permissions
  static async update(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) return res.status(404).json({ message: 'Role tidak ditemukan' });
      if (role.isSystem) return res.status(400).json({ message: 'Role sistem tidak dapat diedit' });

      const { displayName, permissions } = req.body;
      if (displayName?.trim()) await role.update({ displayName: displayName.trim() });

      if (Array.isArray(permissions)) {
        await RolePermission.destroy({ where: { roleId: role.id } });
        if (permissions.length) {
          await RolePermission.bulkCreate(
            permissions.map(permissionKey => ({ roleId: role.id, permissionKey })),
            { ignoreDuplicates: true }
          );
        }
      }

      const updated = await RolePermission.findAll({ where: { roleId: role.id } });
      res.json({ id: role.id, name: role.name, displayName: role.displayName, permissions: updated.map(r => r.permissionKey) });
    } catch (err) { next(err); }
  }

  // DELETE /roles/:id
  static async destroy(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) return res.status(404).json({ message: 'Role tidak ditemukan' });
      if (role.isSystem) return res.status(400).json({ message: 'Role sistem tidak dapat dihapus' });

      await RolePermission.destroy({ where: { roleId: role.id } });
      await role.destroy();
      res.json({ message: `Role "${role.name}" dihapus` });
    } catch (err) { next(err); }
  }
}

module.exports = RoleController;
