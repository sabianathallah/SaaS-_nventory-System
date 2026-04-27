'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const ProductSkuController = require('../controllers/productSkuController');

router.get('/',         ProductSkuController.getSkus);
router.post('/',        ProductSkuController.createSku);
router.put('/:skuId',   ProductSkuController.updateSku);
router.delete('/:skuId', ProductSkuController.deleteSku);

module.exports = router;
