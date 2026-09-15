'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockController');
const rp      = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

router.get('/',    rp('stock.view'),   C.getAll);
router.get('/:id', rp('stock.view'),   C.getById);
router.post('/',   rp('stock.manage'), requireCompany, C.create);
router.put('/:id', rp('stock.manage'), C.update);
router.delete('/:id', rp('stock.manage'), C.delete);

module.exports = router;
