'use strict';
const { userHasPermission } = require('./permCheck');

// Whether `req.user` may create/manage content (tasks, lists) inside a given
// divisi folder — either they belong to it themselves, or they hold
// company-wide task admin rights.
async function canManageDivisi(req, divisi) {
    if (req.user.divisi && req.user.divisi === divisi) return true;
    if (Array.isArray(req.user.divisis) && req.user.divisis.includes(divisi)) return true;
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'COMPANY_ADMIN') return true;
    if (await userHasPermission(req, 'tasks.manage')) return true;
    if (await userHasPermission(req, 'tasks.edit')) return true;
    return false;
}

module.exports = { canManageDivisi };
