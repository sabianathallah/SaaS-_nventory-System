'use strict';
const express = require('express');
const router = express.Router();
const StockOpnameItemController = require('../controllers/stockOpnameItemController');

router.get('/', StockOpnameItemController.getAll);
router.get('/:id', StockOpnameItemController.getById);
router.post('/', StockOpnameItemController.create);
router.put('/:id', StockOpnameItemController.update);
router.delete('/:id', StockOpnameItemController.delete);

module.exports = router;
