'use strict';
const { Role, RolePermission } = require('../models');
const { Op } = require('sequelize');
const { ALL_PERMISSIONS } = require('../helpers/permissions');

// Build child → parent map at startup: { 'stock.in.scan': 'stock.manage', ... }
const PARENT_MAP = {};
for (const p of ALL_PERMISSIONS) {
  if (p.parent) PARENT_MAP[p.key] = p.parent;
}

// Expand a set of keys to also include their parents
function withParents(keys) {
  const expanded = new Set(keys);
  for (const k of keys) {
    if (PARENT_MAP[k]) expanded.add(PARENT_MAP[k]);
  }
  return [...expanded];
}

async function resolveRoleRow(req) {
  const { role, companyId } = req.user;
  return Role.findOne({
    where: { name: role, [Op.or]: [{ companyId }, { companyId: null }] },
    order: [['companyId', 'DESC NULLS LAST']],
  });
}

// Single permission — also passes if user has the parent permission
const requirePermission = (key) => async (req, res, next) => {
  try {
    const { role } = req.user;
    if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') return next();
    const roleRow = await resolveRoleRow(req);
    if (!roleRow) return res.status(403).json({ message: 'Forbidden: Role tidak ditemukan' });
    const keysToCheck = withParents([key]);
    const rp = await RolePermission.findOne({
      where: { roleId: roleRow.id, permissionKey: { [Op.in]: keysToCheck } },
    });
    return rp ? next() : res.status(403).json({ message: 'Forbidden: Permission denied' });
  } catch (err) { next(err); }
};

// OR-based check — also expands each key to include its parent
const requireAnyPermission = (...keys) => async (req, res, next) => {
  try {
    const { role } = req.user;
    if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') return next();
    const roleRow = await resolveRoleRow(req);
    if (!roleRow) return res.status(403).json({ message: 'Forbidden: Role tidak ditemukan' });
    const keysToCheck = withParents(keys);
    const rp = await RolePermission.findOne({
      where: { roleId: roleRow.id, permissionKey: { [Op.in]: keysToCheck } },
    });
    return rp ? next() : res.status(403).json({ message: 'Forbidden: Permission denied' });
  } catch (err) { next(err); }
};

module.exports = requirePermission;
module.exports.requireAnyPermission = requireAnyPermission;
