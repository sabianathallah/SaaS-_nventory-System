'use strict';
const express = require('express');
const router  = express.Router();
const PermissionController = require('../controllers/permissionController');

router.get('/', PermissionController.getAll);

module.exports = router;
