'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const ProductSkuController = require('../controllers/productSkuController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');

const canEdit = rpAny('inventory.manage', 'inventory.product.edit');

router.get('/',          ProductSkuController.getSkus);
router.post('/',         canEdit, ProductSkuController.createSku);
router.put('/:skuId',    canEdit, ProductSkuController.updateSku);
router.delete('/:skuId', canEdit, ProductSkuController.deleteSku);

module.exports = router;
