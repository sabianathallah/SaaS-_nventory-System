'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/reportController');

router.get('/monthly', ctrl.monthly);

module.exports = router;
