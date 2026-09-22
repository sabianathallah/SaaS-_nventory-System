'use strict';
const express = require('express');
const router  = express.Router();
const FormAnakPackingController = require('../controllers/formAnakPackingController');
const requirePermission         = require('../middlewares/requirePermission');

router.get('/',    requirePermission('packing.view'), FormAnakPackingController.getAll);
router.get('/:id', requirePermission('packing.view'), FormAnakPackingController.getById);

module.exports = router;
