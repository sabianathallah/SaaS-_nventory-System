'use strict';
const express = require('express');
const router  = express.Router();
const VendorController = require('../controllers/vendorController');
const checkRoles = require('../middlewares/checkRoles');

const OPS_ADMIN = checkRoles('OPERASIONAL', 'COMPANY_ADMIN', 'ADMIN');

router.get('/',    checkRoles('OPERASIONAL','HEAD_PACKING','CEO','COMPANY_ADMIN','ADMIN'), VendorController.getAll);
router.get('/:id', checkRoles('OPERASIONAL','HEAD_PACKING','CEO','COMPANY_ADMIN','ADMIN'), VendorController.getById);
router.post('/',   OPS_ADMIN, VendorController.create);
router.put('/:id', OPS_ADMIN, VendorController.update);
router.delete('/:id', checkRoles('COMPANY_ADMIN','ADMIN'), VendorController.delete);

module.exports = router;
