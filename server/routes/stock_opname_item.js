'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockOpnameItemController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');

const canView   = rpAny('stock.manage', 'stock.view', 'stock.opname.view');
const canInput  = rpAny('stock.manage', 'stock.opname.create', 'stock.opname.scan', 'stock.opname.manual_input');
const canDelete = rpAny('stock.manage', 'stock.opname.delete');

router.get('/',    canView,                                                                     C.getAll);
router.get('/:id', canView,                                                                     C.getById);
router.post('/',   canInput,                                                                    C.create);
router.put('/:id', rpAny('stock.manage', 'stock.opname.create', 'stock.opname.manual_input'),  C.update);
router.delete('/:id', canDelete,                                                                C.delete);

module.exports = router;
