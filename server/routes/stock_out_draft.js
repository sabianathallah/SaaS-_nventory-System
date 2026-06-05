'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/stockOutDraftController');

router.post('/ensure',              ctrl.ensure);
router.put('/:id',                  ctrl.update);
router.post('/:id/items',           ctrl.addItem);
router.put('/:id/items/:itemId',    ctrl.updateItem);
router.delete('/:id/items/:itemId', ctrl.removeItem);
router.post('/:id/submit',          ctrl.submit);
router.delete('/:id',               ctrl.cancel);

module.exports = router;
