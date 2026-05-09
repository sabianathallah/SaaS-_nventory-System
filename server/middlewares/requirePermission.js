'use strict';
const { Role, RolePermission } = require('../models');
const { Op } = require('sequelize');

async function resolveRoleRow(req) {
  const { role, companyId } = req.user;
  return Role.findOne({
    where: { name: role, [Op.or]: [{ companyId }, { companyId: null }] },
    order: [['companyId', 'DESC NULLS LAST']],
  });
}

// Single permission check
const requirePermission = (key) => async (req, res, next) => {
  try {
    const { role } = req.user;
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return next();
    const roleRow = await resolveRoleRow(req);
    if (!roleRow) return res.status(403).json({ message: 'Forbidden: Role tidak ditemukan' });
    const rp = await RolePermission.findOne({ where: { roleId: roleRow.id, permissionKey: key } });
    return rp ? next() : res.status(403).json({ message: 'Forbidden: Permission denied' });
  } catch (err) { next(err); }
};

// OR-based check: passes if user has ANY of the given keys
const requireAnyPermission = (...keys) => async (req, res, next) => {
  try {
    const { role } = req.user;
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return next();
    const roleRow = await resolveRoleRow(req);
    if (!roleRow) return res.status(403).json({ message: 'Forbidden: Role tidak ditemukan' });
    const rp = await RolePermission.findOne({
      where: { roleId: roleRow.id, permissionKey: { [Op.in]: keys } },
    });
    return rp ? next() : res.status(403).json({ message: 'Forbidden: Permission denied' });
  } catch (err) { next(err); }
};

module.exports = requirePermission;
module.exports.requireAnyPermission = requireAnyPermission;
