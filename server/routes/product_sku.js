'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const ProductSkuController = require('../controllers/productSkuController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

const canEdit = rpAny('inventory.manage', 'inventory.product.edit');

router.get('/',          ProductSkuController.getSkus);
router.post('/',         canEdit, requireCompany, ProductSkuController.createSku);
router.patch('/reorder', canEdit, ProductSkuController.reorderSkus);
router.put('/:skuId',    canEdit, ProductSkuController.updateSku);
router.delete('/:skuId', canEdit, ProductSkuController.deleteSku);

module.exports = router;
