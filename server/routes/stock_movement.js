'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockMovementController');
const rp      = require('../middlewares/requirePermission');
const { requireAnyPermission } = rp;

const canView = requireAnyPermission('stock.view', 'dashboard.view_movements');

router.get('/summary',    canView, C.getSummary);
router.get('/chart',      canView, C.getChart);
router.get('/export/csv', rp('stock.view'), C.exportCsv);
router.get('/',           canView, C.getAll);
router.get('/:id',        canView, C.getById);
router.post('/',          rp('stock.manage'), C.create);
router.delete('/:id',     rp('stock.manage'), C.delete);

module.exports = router;
