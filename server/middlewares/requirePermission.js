'use strict';
const { Role, RolePermission } = require('../models');
const { Op } = require('sequelize');

const requirePermission = (key) => async (req, res, next) => {
  try {
    const { role, companyId } = req.user;
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return next();

    const roleRow = await Role.findOne({
      where: {
        name: role,
        [Op.or]: [{ companyId }, { companyId: null }],
      },
      order: [['companyId', 'DESC NULLS LAST']],
    });

    if (!roleRow) return res.status(403).json({ message: 'Forbidden: Role tidak ditemukan' });

    const rp = await RolePermission.findOne({ where: { roleId: roleRow.id, permissionKey: key } });
    return rp ? next() : res.status(403).json({ message: 'Forbidden: Permission denied' });
  } catch (err) { next(err); }
};

module.exports = requirePermission;
