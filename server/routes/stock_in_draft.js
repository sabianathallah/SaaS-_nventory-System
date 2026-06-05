'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/stockInDraftController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');

const canInput = rpAny('stock.manage', 'stock.in.scan', 'stock.in.manual_input');

router.post('/ensure',              canInput, ctrl.ensure);
router.put('/:id',                  canInput, ctrl.update);
router.post('/:id/items',           canInput, ctrl.addItem);
router.put('/:id/items/:itemId',    canInput, ctrl.updateItem);
router.delete('/:id/items/:itemId', canInput, ctrl.removeItem);
router.post('/:id/submit',          canInput, ctrl.submit);
router.delete('/:id',               canInput, ctrl.cancel);

module.exports = router;
