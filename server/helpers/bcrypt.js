'use strict';

const bcrypt = require('bcryptjs');

const hashPassword = (password) => bcrypt.hashSync(password, 10);

module.exports = { hashPassword };
