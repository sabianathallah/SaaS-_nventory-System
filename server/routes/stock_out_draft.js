'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/stockOutDraftController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');

const canOutput = rpAny('stock.manage', 'stock.out.scan', 'stock.out.manual_input');

router.get('/current',              canOutput, ctrl.current);
router.post('/ensure',              canOutput, ctrl.ensure);
router.post('/',                    canOutput, ctrl.create);
router.get('/:id',                  canOutput, ctrl.get);
router.put('/:id',                  canOutput, ctrl.update);
router.post('/:id/items',           canOutput, ctrl.addItem);
router.put('/:id/items/:itemId',    canOutput, ctrl.updateItem);
router.delete('/:id/items/:itemId', canOutput, ctrl.removeItem);
router.post('/:id/submit',          canOutput, ctrl.submit);
router.delete('/:id',               canOutput, ctrl.cancel);

module.exports = router;
