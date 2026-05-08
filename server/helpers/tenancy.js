'use strict';

/**
 * Returns a Sequelize WHERE clause fragment for company scoping.
 * - SUPER_ADMIN: sees all, or filter by ?companyId= query param
 * - Everyone else: scoped to their own companyId
 */
function companyFilter(req) {
    if (req.user.role === 'SUPER_ADMIN') {
        return req.query.companyId ? { companyId: parseInt(req.query.companyId) } : {};
    }
    return { companyId: req.user.companyId };
}

/**
 * Returns companyId to set on new records.
 * - SUPER_ADMIN: must provide companyId in body
 * - Everyone else: taken from token
 */
function companyId(req) {
    if (req.user.role === 'SUPER_ADMIN') {
        const fromBody  = req.body?.companyId;
        const fromQuery = req.query?.companyId ? parseInt(req.query.companyId) : null;
        return fromBody || fromQuery || null;
    }
    return req.user.companyId;
}

module.exports = { companyFilter, companyId };
