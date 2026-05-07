'use strict';
const express = require('express');
const router  = express.Router();
const RolePermissionController = require('../controllers/rolePermissionController');
const checkRoles = require('../middlewares/checkRoles');

const ADMIN_ROLES = checkRoles('SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN');

router.get('/',         ADMIN_ROLES, RolePermissionController.getAll);
router.post('/',        ADMIN_ROLES, RolePermissionController.createRole);
router.put('/:role',    ADMIN_ROLES, RolePermissionController.update);
router.delete('/:role', ADMIN_ROLES, RolePermissionController.deleteRole);

module.exports = router;
