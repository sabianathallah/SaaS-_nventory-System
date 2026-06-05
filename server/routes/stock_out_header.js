'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockOutHeaderController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const requireCompany              = require('../middlewares/requireCompany');
const requireWarehouseNotInOpname = require('../middlewares/requireWarehouseNotInOpname');

const canView       = rpAny('stock.manage', 'stock.view', 'stock.out.view');
const canCreate     = rpAny('stock.manage', 'stock.out.create', 'stock.out.scan', 'stock.out.manual_input');
const canEdit       = rpAny('stock.manage', 'stock.out.create');
const canDelete     = rpAny('stock.manage', 'stock.out.delete');
const canDeleteItem = rpAny('stock.manage', 'stock.out.delete_item');

router.get('/',       canView,                                               C.getAll);
router.get('/:id',    canView,                                               C.getById);
router.post('/',      canCreate, requireCompany, requireWarehouseNotInOpname, C.create);
router.put('/:id',    canEdit,                                               C.update);
router.delete('/:id', canDelete,                                             C.delete);

module.exports = router;
