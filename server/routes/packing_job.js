'use strict';
const express = require('express');
const router  = express.Router();
const PackingJobController = require('../controllers/packingJobController');
const checkRoles = require('../middlewares/checkRoles');

const READ_ROLES  = checkRoles('HEAD_PACKING','TIM_PACKING','OPERASIONAL','CEO','COMPANY_ADMIN','ADMIN');
const HEAD_ROLES  = checkRoles('HEAD_PACKING','COMPANY_ADMIN','ADMIN');
const PACK_ROLES  = checkRoles('TIM_PACKING','COMPANY_ADMIN','ADMIN');

router.get('/workers', HEAD_ROLES, PackingJobController.getWorkers);
router.get('/',    READ_ROLES, PackingJobController.getAll);
router.get('/:id', READ_ROLES, PackingJobController.getById);
router.post('/',   HEAD_ROLES, PackingJobController.create);

router.post('/:id/start',  PACK_ROLES, PackingJobController.start);
router.post('/:id/submit', PACK_ROLES, PackingJobController.submit);
router.post('/:id/verify', HEAD_ROLES, PackingJobController.verify);

module.exports = router;
