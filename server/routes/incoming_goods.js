'use strict';
const express = require('express');
const router  = express.Router();
const IGController      = require('../controllers/incomingGoodsController');
const requirePermission = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

router.get('/',    requirePermission('packing.view'),     IGController.getAll);
router.get('/:id', requirePermission('packing.view'),     IGController.getById);
router.post('/',   requirePermission('packing.incoming'), requireCompany, IGController.create);
router.put('/:id', requirePermission('packing.incoming'), IGController.update);
router.delete('/:id', requirePermission('packing.incoming'), IGController.delete);

router.put('/:id/items/:itemId',      requirePermission('packing.incoming'), IGController.updateItem);
router.post('/:id/confirm-vendor',    requirePermission('packing.incoming'), IGController.confirmVendor);
router.post('/:id/notify-production', requirePermission('packing.incoming'), IGController.notifyProduction);
router.post('/:id/complete',          requirePermission('packing.incoming'), IGController.complete);

module.exports = router;
