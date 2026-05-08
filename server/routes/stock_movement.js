'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockMovementController');
const rp      = require('../middlewares/requirePermission');

router.get('/summary',    rp('stock.view'),   C.getSummary);
router.get('/chart',      rp('stock.view'),   C.getChart);
router.get('/export/csv', rp('stock.view'),   C.exportCsv);
router.get('/',           rp('stock.view'),   C.getAll);
router.get('/:id',        rp('stock.view'),   C.getById);
router.post('/',          rp('stock.manage'), C.create);
router.delete('/:id',     rp('stock.manage'), C.delete);

module.exports = router;
