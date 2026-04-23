'use strict';
const express = require('express');
const router  = express.Router();
const IGController = require('../controllers/incomingGoodsController');
const checkRoles   = require('../middlewares/checkRoles');

const READ_ROLES   = checkRoles('OPERASIONAL','PRODUKSI','HEAD_PACKING','CEO','COMPANY_ADMIN','ADMIN');
const OPS_ROLES    = checkRoles('OPERASIONAL','COMPANY_ADMIN','ADMIN');

router.get('/',    READ_ROLES, IGController.getAll);
router.get('/:id', READ_ROLES, IGController.getById);
router.post('/',   OPS_ROLES,  IGController.create);
router.put('/:id', OPS_ROLES,  IGController.update);
router.delete('/:id', OPS_ROLES, IGController.delete);

router.put('/:id/items/:itemId', OPS_ROLES, IGController.updateItem);

router.post('/:id/confirm-vendor',    OPS_ROLES, IGController.confirmVendor);
router.post('/:id/notify-production', OPS_ROLES, IGController.notifyProduction);
router.post('/:id/complete',          OPS_ROLES, IGController.complete);

module.exports = router;
