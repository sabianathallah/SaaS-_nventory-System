'use strict';
const express = require('express');
const router = express.Router();
const StockOpnameSessionController = require('../controllers/stockOpnameSessionController');

router.get('/', StockOpnameSessionController.getAll);
router.get('/:id', StockOpnameSessionController.getById);
router.post('/', StockOpnameSessionController.create);
router.put('/:id', StockOpnameSessionController.update);
router.delete('/:id', StockOpnameSessionController.delete);

module.exports = router;
