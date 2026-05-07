'use strict';
const { RolePermission } = require('../models');
const { DEFAULT_PERMISSIONS } = require('../helpers/permissions');

// Middleware that checks a specific permission key against DB + defaults.
// Handles both system roles and custom roles.
const requirePermission = (key) => async (req, res, next) => {
  try {
    const { role, companyId } = req.user;
    const roleUpper = role?.toUpperCase();

    // SUPER_ADMIN and ADMIN always pass
    if (roleUpper === 'SUPER_ADMIN' || roleUpper === 'ADMIN') return next();

    // DB record takes precedence (covers custom roles + admin-overridden roles)
    const record = await RolePermission.findOne({ where: { role, companyId } });
    if (record) {
      return record.permissions.includes(key)
        ? next()
        : res.status(403).json({ message: 'Forbidden: Permission denied' });
    }

    // Fall back to hardcoded defaults
    if (DEFAULT_PERMISSIONS[role]?.includes(key)) return next();

    return res.status(403).json({ message: 'Forbidden: Permission denied' });
  } catch (err) { next(err); }
};

module.exports = requirePermission;
