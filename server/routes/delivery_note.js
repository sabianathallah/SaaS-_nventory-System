'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/deliveryNoteController');
const { uploadSingle } = require('../helpers/cloudinary');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');

const canView   = rpAny('packing.manage', 'packing.incoming', 'packing.view');
const canManage = rpAny('packing.manage', 'packing.incoming');

router.get('/',     canView,   ctrl.list);
router.get('/:id',  canView,   ctrl.get);
router.post('/',    canManage, uploadSingle('photo', 'saas-inventory/surat-jalan'), ctrl.create);
router.put('/:id',  canManage, uploadSingle('photo', 'saas-inventory/surat-jalan'), ctrl.update);
router.delete('/:id', canManage, ctrl.destroy);

module.exports = router;
