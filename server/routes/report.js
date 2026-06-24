'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/reportController');

router.get('/monthly',  ctrl.monthly);
router.get('/daily',    ctrl.daily);
router.get('/yearly',   ctrl.yearly);
router.get('/snapshot', ctrl.snapshot);

module.exports = router;
