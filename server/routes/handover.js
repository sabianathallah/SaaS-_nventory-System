'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/handoverController');
const rp      = require('../middlewares/requirePermission');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

const canView   = rpAny('handover.manage', 'handover.view', 'handover.create');
const canCreate = rpAny('handover.manage', 'handover.create');

router.get('/',                        canView,   ctrl.list);
router.post('/',                       canCreate, requireCompany, ctrl.create);
router.get('/:id',                     canView,   ctrl.get);
router.put('/:id',                     canCreate, ctrl.update);
router.delete('/:id',                  rp('handover.manage'), ctrl.destroy);
router.patch('/:id/close',             canCreate, ctrl.closeSession);
router.patch('/:id/reopen',            canCreate, ctrl.reopenSession);
router.post('/:id/items',              canCreate, ctrl.addResi);
router.delete('/:id/items/:itemId',    canCreate, ctrl.removeResi);
router.post('/:id/attachment',         canCreate, ctrl.setAttachmentUrl);
router.delete('/:id/attachment',       canCreate, ctrl.deleteAttachment);

module.exports = router;
