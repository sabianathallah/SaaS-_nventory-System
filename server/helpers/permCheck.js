'use strict';
const { Role, RolePermission } = require('../models');
const { Op } = require('sequelize');
const { ALL_PERMISSIONS } = require('./permissions');

const PARENT_MAP = {};
for (const p of ALL_PERMISSIONS) {
    if (p.parent) PARENT_MAP[p.key] = p.parent;
}

/**
 * Checks a permission key for req.user outside of route middleware
 * (e.g. to branch query scope inside a controller).
 */
async function userHasPermission(req, key) {
    const { role, companyId } = req.user;
    if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') return true;

    const roleRow = await Role.findOne({
        where: { name: role, [Op.or]: [{ companyId }, { companyId: null }] },
        order: [['companyId', 'DESC NULLS LAST']],
    });
    if (!roleRow) return false;

    const keysToCheck = [key];
    if (PARENT_MAP[key]) keysToCheck.push(PARENT_MAP[key]);

    const rp = await RolePermission.findOne({
        where: { roleId: roleRow.id, permissionKey: { [Op.in]: keysToCheck } },
    });
    return !!rp;
}

module.exports = { userHasPermission };
