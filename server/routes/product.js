'use strict';
const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');
const { uploadSingle } = require('../helpers/cloudinary');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

router.get('/',    ProductController.getAll);
router.get('/:id', ProductController.getById);
router.post('/',   rpAny('inventory.manage', 'inventory.product.create'), requireCompany, uploadSingle('image'), ProductController.create);
router.put('/:id', rpAny('inventory.manage', 'inventory.product.edit'),   uploadSingle('image'), ProductController.update);
router.delete('/:id', rpAny('inventory.manage', 'inventory.product.delete'), ProductController.delete);

module.exports = router;
