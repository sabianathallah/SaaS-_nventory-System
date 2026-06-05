'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/handoverController');
const rp      = require('../middlewares/requirePermission');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');

const canView   = rpAny('handover.manage', 'handover.view', 'handover.create');
const canCreate = rpAny('handover.manage', 'handover.create');

router.get('/',                     canView,   ctrl.list);
router.post('/',                    canCreate, ctrl.create);
router.get('/:id',                  canView,   ctrl.get);
router.put('/:id',                  canCreate, ctrl.update);
router.delete('/:id',               rp('handover.manage'), ctrl.destroy);
router.post('/:id/items',           canCreate, ctrl.addResi);
router.delete('/:id/items/:itemId', canCreate, ctrl.removeResi);

module.exports = router;
