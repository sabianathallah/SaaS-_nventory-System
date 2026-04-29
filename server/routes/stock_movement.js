'use strict';
const express = require('express');
const router = express.Router();
const StockMovementController = require('../controllers/stockMovementController');

router.get('/summary', StockMovementController.getSummary);
router.get('/chart', StockMovementController.getChart);
router.get('/export/csv', StockMovementController.exportCsv);
router.get('/', StockMovementController.getAll);
router.get('/:id', StockMovementController.getById);
router.post('/', StockMovementController.create);
router.delete('/:id', StockMovementController.delete);

module.exports = router;
