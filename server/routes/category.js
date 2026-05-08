'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/categoryController');
const rp      = require('../middlewares/requirePermission');

// GET is open — categories are needed as dropdown options in product forms
router.get('/',    C.getAll);
router.get('/:id', C.getById);
router.post('/',   rp('inventory.manage'), C.create);
router.put('/:id', rp('inventory.manage'), C.update);
router.delete('/:id', rp('inventory.manage'), C.delete);

module.exports = router;
