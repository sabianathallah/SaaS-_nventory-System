'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/shipmentCategoryController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');

const canView   = rpAny('shipping.manual.manage', 'shipping.manual.view', 'shipping.manual.create');
const canManage = rpAny('shipping.manual.manage', 'shipping.manual.category.manage');

router.get('/',       canView,   ctrl.list);
router.post('/',      canManage, ctrl.create);
router.put('/:id',   canManage, ctrl.update);
router.delete('/:id', canManage, ctrl.destroy);

module.exports = router;
