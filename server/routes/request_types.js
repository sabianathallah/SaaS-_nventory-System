'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/requestTypeController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');

const canManage = rpAny('request.manage', 'inventory.manage');

router.get('/',       ctrl.list);          // siapa pun (perlu untuk form buat pengajuan)
router.post('/',      canManage, ctrl.create);
router.put('/:id',    canManage, ctrl.update);
router.delete('/:id', canManage, ctrl.destroy);

module.exports = router;
