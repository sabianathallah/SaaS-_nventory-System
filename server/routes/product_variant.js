'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const ProductVariantController = require('../controllers/productVariantController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

const canEdit = rpAny('inventory.manage', 'inventory.product.edit');

// Variant Types
router.get('/',           ProductVariantController.getVariantTypes);
router.post('/',          canEdit, requireCompany, ProductVariantController.createVariantType);
router.patch('/reorder',  canEdit, ProductVariantController.reorderTypes);
router.put('/:typeId',    canEdit, ProductVariantController.updateVariantType);
router.delete('/:typeId', canEdit, ProductVariantController.deleteVariantType);

// Variant Options (nested under type)
router.post('/:typeId/options',                  canEdit, ProductVariantController.createVariantOption);
router.patch('/:typeId/options/reorder',         canEdit, ProductVariantController.reorderOptions);
router.put('/:typeId/options/:optionId',         canEdit, ProductVariantController.updateVariantOption);
router.delete('/:typeId/options/:optionId',      canEdit, ProductVariantController.deleteVariantOption);

module.exports = router;
