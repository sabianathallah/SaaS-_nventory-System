'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/skuWarehouseStockController');

router.get('/', ctrl.list);

module.exports = router;
