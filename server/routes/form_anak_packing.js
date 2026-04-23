'use strict';
const express = require('express');
const router  = express.Router();
const FormAnakPackingController = require('../controllers/formAnakPackingController');
const checkRoles = require('../middlewares/checkRoles');

const READ_ROLES = checkRoles('HR','HEAD_PACKING','TIM_PACKING','OPERASIONAL','CEO','COMPANY_ADMIN','ADMIN');

router.get('/',    READ_ROLES, FormAnakPackingController.getAll);
router.get('/:id', READ_ROLES, FormAnakPackingController.getById);

module.exports = router;
