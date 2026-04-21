'use strict';
const express = require('express');
const router = express.Router();
const StockOutHeaderController = require('../controllers/stockOutHeaderController');

router.get('/', StockOutHeaderController.getAll);
router.get('/:id', StockOutHeaderController.getById);
router.post('/', StockOutHeaderController.create);
router.put('/:id', StockOutHeaderController.update);
router.delete('/:id', StockOutHeaderController.delete);

module.exports = router;
