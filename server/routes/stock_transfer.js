'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/stockTransferController');
const rp     = require('../middlewares/requirePermission');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');

const canView   = rpAny('stock.transfer.manage', 'stock.transfer.view', 'stock.transfer.create');
const canCreate = rpAny('stock.transfer.manage', 'stock.transfer.create');
const canDelete = rpAny('stock.transfer.manage', 'stock.transfer.delete');

router.get('/',       canView,   ctrl.list);
router.get('/:id',    canView,   ctrl.get);
router.post('/',      canCreate, ctrl.create);
router.delete('/:id', canDelete, ctrl.destroy);

module.exports = router;
