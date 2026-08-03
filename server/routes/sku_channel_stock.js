'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/skuChannelStockController');
const rp             = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

router.get('/', ctrl.list);
router.put('/', rp('channel.manage'), requireCompany, ctrl.upsert);
router.put('/bulk-publish', rp('channel.manage'), requireCompany, ctrl.bulkPublish);

module.exports = router;
