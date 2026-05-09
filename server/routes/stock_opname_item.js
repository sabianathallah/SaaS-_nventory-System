'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockOpnameItemController');
const rp      = require('../middlewares/requirePermission');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');

router.get('/',       rp('stock.view'),  C.getAll);
router.get('/:id',    rp('stock.view'),  C.getById);
router.post('/',      rpAny('stock.manage', 'stock.opname.scan', 'stock.opname.manual_input'), C.create);
router.put('/:id',    rpAny('stock.manage', 'stock.opname.manual_input'), C.update);
router.delete('/:id', rp('stock.manage'), C.delete);

module.exports = router;
