'use strict';

const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'inventory_saas_secret_key';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const signToken = (payload) => jwt.sign(payload, SECRET_KEY, { expiresIn: EXPIRES_IN });

const verifyToken = (token) => jwt.verify(token, SECRET_KEY);

module.exports = { signToken, verifyToken };
