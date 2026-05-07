'use strict';
const express = require('express');
const router  = express.Router();
const SuratJalanController = require('../controllers/suratJalanController');
const requirePermission    = require('../middlewares/requirePermission');

router.get('/',    requirePermission('packing.view'),     SuratJalanController.getAll);
router.get('/:id', requirePermission('packing.view'),     SuratJalanController.getById);
router.post('/:id/print', requirePermission('packing.incoming'), SuratJalanController.markPrinted);

module.exports = router;
