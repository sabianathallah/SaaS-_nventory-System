'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockOutPurposeController');
const { requireAnyPermission: rpAny } = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

const canManage = rpAny('stock.manage', 'inventory.manage', 'stock.out.create', 'stock.out.scan', 'stock.out.manual_input');

// GET open — tujuan Stock Out dipakai sebagai dropdown di form, lintas role
router.get('/',    C.getAll);
router.get('/:id', C.getById);
router.post('/',   canManage, requireCompany, C.create);
router.put('/:id', canManage, C.update);
router.delete('/:id', canManage, C.delete);

module.exports = router;
