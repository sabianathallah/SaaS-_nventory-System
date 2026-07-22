'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/vendorDeliveryController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const { uploadArray } = require('../helpers/cloudinary');

const canView   = rpAny('packing.manage', 'packing.incoming', 'packing.view');
const canManage = rpAny('packing.manage', 'packing.incoming');
const uploadSJ  = uploadArray('sjPhotoFiles', 8, 'saas-inventory/surat-jalan');

router.get('/',                canView,             ctrl.list);
router.get('/analytics',       canView,             ctrl.analytics);
router.get('/stock-breakdown', canView,             ctrl.stockBreakdown);
router.post('/',          canManage, uploadSJ, ctrl.create);
router.get('/:id',        canView,             ctrl.get);
router.put('/:id', canManage, uploadSJ, ctrl.update);
router.delete('/:id', canManage, ctrl.destroy);

router.patch('/:id/selisih-status', canManage, ctrl.patchSelisihStatus);
router.patch('/:id/status',         rpAny('packing.manage', 'packing.incoming.close'), ctrl.patchStatus);

router.post('/:id/items',           canManage, ctrl.addItem);
router.put('/:id/items/:itemId',    canManage, ctrl.updateItem);
router.delete('/:id/items/:itemId', canManage, ctrl.removeItem);

module.exports = router;
