'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockInHeaderController');
const rp      = require('../middlewares/requirePermission');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const requireCompany             = require('../middlewares/requireCompany');
const requireWarehouseNotInOpname = require('../middlewares/requireWarehouseNotInOpname');

const canInputIn  = rpAny('stock.manage', 'stock.in.scan', 'stock.in.manual_input');
const canEditIn   = rpAny('stock.manage', 'stock.in.manual_input');
const canDeleteIn = rpAny('stock.manage', 'stock.in.delete_item');

router.get('/resolve-sku',           rpAny('stock.manage', 'stock.in.scan', 'stock.in.manual_input'), C.resolveSku);
router.get('/',                      rp('stock.view'),  C.getAll);
router.get('/:id',                   rp('stock.view'),  C.getById);
router.post('/',                     canInputIn,        requireCompany, requireWarehouseNotInOpname, C.create);
router.put('/:id',                   rp('stock.manage'), C.update);
router.delete('/:id',                rp('stock.manage'), C.delete);

router.post('/:id/items',            canInputIn,   requireCompany, requireWarehouseNotInOpname, C.addItem);
router.put('/:id/items/:itemId',     canEditIn,    C.updateItem);
router.delete('/:id/items/:itemId',  canDeleteIn,  C.removeItem);

module.exports = router;
