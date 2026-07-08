'use strict';
const express = require('express');
const router  = express.Router();
const PackingJobController  = require('../controllers/packingJobController');
const requirePermission     = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

router.get('/workers', requirePermission('packing.verify'), PackingJobController.getWorkers);
router.get('/',        requirePermission('packing.view'),   PackingJobController.getAll);
router.get('/:id',     requirePermission('packing.view'),   PackingJobController.getById);
router.post('/',       requirePermission('packing.verify'), requireCompany, PackingJobController.create);

router.post('/:id/start',  requirePermission('packing.jobs'),   PackingJobController.start);
router.post('/:id/submit', requirePermission('packing.jobs'),   PackingJobController.submit);
router.post('/:id/verify', requirePermission('packing.verify'), PackingJobController.verify);

module.exports = router;
