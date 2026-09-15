'use strict';
const express = require('express');
const router  = express.Router();
const RoleController = require('../controllers/roleController');
const checkRoles = require('../middlewares/checkRoles');

const ADMIN_ROLES = checkRoles('SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN');

router.get('/',            ADMIN_ROLES, RoleController.getAll);
router.post('/',           ADMIN_ROLES, RoleController.create);
router.put('/:id',         ADMIN_ROLES, RoleController.update);
router.post('/:id/reset',  ADMIN_ROLES, RoleController.resetDefaults);
router.delete('/:id',      ADMIN_ROLES, RoleController.destroy);

module.exports = router;
