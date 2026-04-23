'use strict';
const express = require('express');
const router  = express.Router();
const SuratJalanController = require('../controllers/suratJalanController');
const checkRoles = require('../middlewares/checkRoles');

const READ_ROLES  = checkRoles('OPERASIONAL','PRODUKSI','HEAD_PACKING','CEO','COMPANY_ADMIN','ADMIN');
const PRINT_ROLES = checkRoles('OPERASIONAL','PRODUKSI','COMPANY_ADMIN','ADMIN');

router.get('/',    READ_ROLES,  SuratJalanController.getAll);
router.get('/:id', READ_ROLES,  SuratJalanController.getById);
router.post('/:id/print', PRINT_ROLES, SuratJalanController.markPrinted);

module.exports = router;
