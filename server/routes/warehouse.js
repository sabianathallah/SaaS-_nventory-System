'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/warehouseController');
const rp             = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

// GET is open — warehouses are needed as dropdown options in many forms
router.get('/',    C.getAll);
router.get('/:id', C.getById);
router.post('/',   rp('stock.manage'), requireCompany, C.create);
router.put('/:id', rp('stock.manage'), C.update);
router.delete('/:id', rp('stock.manage'), C.delete);

module.exports = router;
