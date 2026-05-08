'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockInHeaderController');
const rp      = require('../middlewares/requirePermission');

router.get('/resolve-sku',           rp('stock.manage'), C.resolveSku);
router.get('/',                      rp('stock.view'),   C.getAll);
router.get('/:id',                   rp('stock.view'),   C.getById);
router.post('/',                     rp('stock.manage'), C.create);
router.put('/:id',                   rp('stock.manage'), C.update);
router.delete('/:id',                rp('stock.manage'), C.delete);

router.post('/:id/items',            rp('stock.manage'), C.addItem);
router.put('/:id/items/:itemId',     rp('stock.manage'), C.updateItem);
router.delete('/:id/items/:itemId',  rp('stock.manage'), C.removeItem);

module.exports = router;
