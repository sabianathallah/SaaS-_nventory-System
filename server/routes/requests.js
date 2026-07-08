'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/requestController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

const canView    = rpAny('request.manage', 'request.view', 'request.create', 'request.process');
const canCreate  = rpAny('request.manage', 'request.create');
const canProcess = rpAny('request.manage', 'request.process');
const canManage  = rpAny('request.manage');

// Static routes must come before /:id to avoid clash
router.get('/export',        canView,    ctrl.exportData);
router.get('/status-counts', canView,    ctrl.statusCounts);

router.get('/',      canView,   ctrl.list);
router.post('/',     canCreate, requireCompany, ctrl.create);
router.get('/:id',   canView,   ctrl.getById);
router.put('/:id',   canCreate, ctrl.update);
router.delete('/:id',canManage, ctrl.destroy);

router.post('/:id/approve',          canProcess, ctrl.approve);
router.post('/:id/reject',           canProcess, ctrl.reject);
router.post('/:id/process-shipment', canProcess, ctrl.processShipment);
router.patch('/:id/sent',            canProcess, ctrl.markSent);
router.patch('/:id/returned',        canProcess, ctrl.markReturned);
router.patch('/:id/ship-remaining',  canProcess, ctrl.shipRemaining);
router.patch('/:id/done',            canProcess, ctrl.markDone);

module.exports = router;
