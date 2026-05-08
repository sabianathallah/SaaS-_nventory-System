'use strict';
const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');
const { uploadSingle } = require('../helpers/cloudinary');
const requirePermission = require('../middlewares/requirePermission');

router.get('/', ProductController.getAll);
router.get('/:id', ProductController.getById);
router.post('/', requirePermission('inventory.manage'), uploadSingle('image'), ProductController.create);
router.put('/:id', requirePermission('inventory.manage'), uploadSingle('image'), ProductController.update);
router.delete('/:id', requirePermission('inventory.manage'), ProductController.delete);

module.exports = router;
