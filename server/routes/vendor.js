'use strict';
const express = require('express');
const router  = express.Router();
const VendorController  = require('../controllers/vendorController');
const requirePermission = require('../middlewares/requirePermission');
const checkRoles        = require('../middlewares/checkRoles');

router.get('/',    requirePermission('packing.incoming'), VendorController.getAll);
router.get('/:id', requirePermission('packing.incoming'), VendorController.getById);
router.post('/',   requirePermission('packing.incoming'), VendorController.create);
router.put('/:id', requirePermission('packing.incoming'), VendorController.update);
router.delete('/:id', checkRoles('COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'), VendorController.delete);

module.exports = router;
