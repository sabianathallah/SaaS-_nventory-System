'use strict';
const { Op } = require('sequelize');

async function generateDocNumber(model, field, prefix, whereExtra = {}) {
    const today = new Date();
    const dateStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
    ].join('');
    const prefixToday = `${prefix}-${dateStr}-`;

    const last = await model.findOne({
        where: { [field]: { [Op.like]: `${prefixToday}%` }, ...whereExtra },
        order: [[field, 'DESC']],
        attributes: [field],
    });

    const seq = last ? parseInt(last[field].slice(-4), 10) + 1 : 1;
    return `${prefixToday}${String(seq).padStart(4, '0')}`;
}

module.exports = { generateDocNumber };
