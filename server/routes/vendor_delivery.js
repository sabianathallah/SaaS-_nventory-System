'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/vendorDeliveryController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const { uploadSingle } = require('../helpers/cloudinary');

const canView   = rpAny('packing.manage', 'packing.incoming', 'packing.view');
const canManage = rpAny('packing.manage', 'packing.incoming');
const uploadSJ  = uploadSingle('sjPhoto', 'saas-inventory/surat-jalan');

router.get('/',    canView,             ctrl.list);
router.post('/',   canManage, uploadSJ, ctrl.create);
router.get('/:id', canView,             ctrl.get);
router.put('/:id', canManage, uploadSJ, ctrl.update);
router.delete('/:id', canManage, ctrl.destroy);

router.post('/:id/items',           canManage, ctrl.addItem);
router.put('/:id/items/:itemId',    canManage, ctrl.updateItem);
router.delete('/:id/items/:itemId', canManage, ctrl.removeItem);

module.exports = router;
