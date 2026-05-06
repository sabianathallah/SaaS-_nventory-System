'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams agar :productId tersedia
const ProductVariantController = require('../controllers/productVariantController');

// Variant Types
router.get('/',        ProductVariantController.getVariantTypes);
router.post('/',       ProductVariantController.createVariantType);
router.put('/:typeId', ProductVariantController.updateVariantType);
router.delete('/:typeId', ProductVariantController.deleteVariantType);

// Variant Options (nested under type)
router.post('/:typeId/options',                    ProductVariantController.createVariantOption);
router.patch('/:typeId/options/reorder',           ProductVariantController.reorderOptions);
router.put('/:typeId/options/:optionId',           ProductVariantController.updateVariantOption);
router.delete('/:typeId/options/:optionId',        ProductVariantController.deleteVariantOption);

module.exports = router;
