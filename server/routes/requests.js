'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/requestController');

// Static routes must come before /:id to avoid clash
router.get('/export',        ctrl.exportData);
router.get('/status-counts', ctrl.statusCounts);

router.get('/',         ctrl.list);
router.post('/',        ctrl.create);
router.get('/:id',      ctrl.getById);
router.put('/:id',      ctrl.update);
router.delete('/:id',   ctrl.destroy);

router.post('/:id/approve',  ctrl.approve);
router.post('/:id/reject',   ctrl.reject);
router.patch('/:id/sent',    ctrl.markSent);
router.patch('/:id/returned',      ctrl.markReturned);
router.patch('/:id/ship-remaining', ctrl.shipRemaining);
router.patch('/:id/done',           ctrl.markDone);

module.exports = router;
