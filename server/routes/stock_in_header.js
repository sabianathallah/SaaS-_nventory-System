'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockInHeaderController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const requireCompany              = require('../middlewares/requireCompany');
const requireWarehouseNotInOpname = require('../middlewares/requireWarehouseNotInOpname');

const canView       = rpAny('stock.manage', 'stock.view', 'stock.in.view');
const canCreate     = rpAny('stock.manage', 'stock.in.create', 'stock.in.scan', 'stock.in.manual_input');
const canEdit       = rpAny('stock.manage', 'stock.in.create');
const canDelete     = rpAny('stock.manage', 'stock.in.delete');
const canDeleteItem = rpAny('stock.manage', 'stock.in.delete_item');

router.get('/resolve-sku', canCreate,                                       C.resolveSku);
router.get('/',            canView,                                          C.getAll);
router.get('/:id',         canView,                                          C.getById);
router.post('/',           canCreate, requireCompany, requireWarehouseNotInOpname, C.create);
router.put('/:id',         canEdit,                                          C.update);
router.delete('/:id',      canDelete,                                        C.delete);

router.post('/:id/items',           canCreate, requireCompany, requireWarehouseNotInOpname, C.addItem);
router.put('/:id/items/:itemId',    canEdit,                                 C.updateItem);
router.delete('/:id/items/:itemId', canDeleteItem,                           C.removeItem);

module.exports = router;
