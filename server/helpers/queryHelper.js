'use strict';
const { Op } = require('sequelize');

/**
 * Extracts page/limit from query, returns offset + pagination metadata carrier.
 */
function paginate(query) {
    const page  = Math.max(1, parseInt(query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

/**
 * Builds a Sequelize WHERE fragment from query params using a field schema.
 *
 * schema format:
 *   { queryParam: 'like' | 'exact' | 'gte' | 'lte' | 'in' }
 *   { queryParam: { field: 'dbColumn', type: 'like' | 'exact' | 'gte' | 'lte' | 'in' } }
 *
 * Example:
 *   buildFilter(req.query, {
 *     name:     'like',
 *     CategoryId: 'exact',
 *     dateFrom: { field: 'date', type: 'gte' },
 *     dateTo:   { field: 'date', type: 'lte' },
 *   })
 */
function buildFilter(query, schema) {
    const where = {};
    for (const [param, config] of Object.entries(schema)) {
        const value = query[param];
        if (value === undefined || value === '') continue;

        const field = typeof config === 'object' ? (config.field || param) : param;
        const type  = typeof config === 'object' ? config.type : config;

        switch (type) {
            case 'exact':
                where[field] = value;
                break;
            case 'like':
                where[field] = { [Op.iLike]: `%${value}%` };
                break;
            case 'gte':
                where[field] = { ...(where[field] || {}), [Op.gte]: new Date(value) };
                break;
            case 'lte':
                where[field] = { ...(where[field] || {}), [Op.lte]: new Date(value) };
                break;
            case 'in':
                where[field] = { [Op.in]: value.split(',') };
                break;
        }
    }
    return where;
}

/**
 * Wraps findAndCountAll result into a standard paginated response.
 */
function paginatedResponse(rows, count, page, limit) {
    return {
        data: rows,
        pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        }
    };
}

module.exports = { paginate, buildFilter, paginatedResponse };
