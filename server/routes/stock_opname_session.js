'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockOpnameSessionController');
const rp      = require('../middlewares/requirePermission');

router.get('/',    rp('stock.view'),   C.getAll);
router.get('/:id', rp('stock.view'),   C.getById);
router.post('/',   rp('stock.manage'), C.create);
router.put('/:id', rp('stock.manage'), C.update);
router.delete('/:id', rp('stock.manage'), C.delete);

module.exports = router;
