'use strict';
const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');
const { uploadSingle } = require('../helpers/cloudinary');

router.get('/', ProductController.getAll);
router.get('/:id', ProductController.getById);
router.post('/', uploadSingle('image'), ProductController.create);
router.put('/:id', uploadSingle('image'), ProductController.update);
router.delete('/:id', ProductController.delete);

module.exports = router;
