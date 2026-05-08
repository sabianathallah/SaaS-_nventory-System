'use strict';
const { Op } = require('sequelize');

/**
 * Returns a Sequelize WHERE clause fragment for company scoping.
 * - SUPER_ADMIN: sees all, or filter by ?companyId= query param
 *   When filtering by companyId, also includes orphaned records (companyId IS NULL)
 * - Everyone else: scoped to their own companyId
 */
function companyFilter(req) {
    if (req.user.role === 'SUPER_ADMIN') {
        if (req.query.companyId) {
            const cid = parseInt(req.query.companyId);
            return { companyId: { [Op.or]: [cid, null] } };
        }
        return {};
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
