'use strict';
const express = require('express');
const router = express.Router();
const StockController = require('../controllers/stockController');

router.get('/', StockController.getAll);
router.get('/:id', StockController.getById);
router.post('/', StockController.create);
router.put('/:id', StockController.update);
router.delete('/:id', StockController.delete);

module.exports = router;
