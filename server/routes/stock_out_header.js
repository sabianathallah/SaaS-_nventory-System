'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockOutHeaderController');
const rp      = require('../middlewares/requirePermission');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const requireCompany             = require('../middlewares/requireCompany');
const requireWarehouseNotInOpname = require('../middlewares/requireWarehouseNotInOpname');

router.get('/',       rp('stock.view'),  C.getAll);
router.get('/:id',    rp('stock.view'),  C.getById);
router.post('/',      rpAny('stock.manage', 'stock.out.scan', 'stock.out.manual_input'), requireCompany, requireWarehouseNotInOpname, C.create);
router.put('/:id',    rp('stock.manage'), C.update);
router.delete('/:id', rp('stock.manage'), C.delete);

module.exports = router;
