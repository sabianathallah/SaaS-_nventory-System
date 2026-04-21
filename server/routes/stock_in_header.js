'use strict';
const express = require('express');
const router = express.Router();
const StockInHeaderController = require('../controllers/stockInHeaderController');

router.get('/', StockInHeaderController.getAll);
router.get('/:id', StockInHeaderController.getById);
router.post('/', StockInHeaderController.create);
router.put('/:id', StockInHeaderController.update);
router.delete('/:id', StockInHeaderController.delete);

module.exports = router;
