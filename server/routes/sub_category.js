'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/subCategoryController');
const rp             = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

// GET is open — sub categories are needed as dropdown options in product forms
router.get('/',    C.getAll);
router.get('/:id', C.getById);
router.post('/',   rp('inventory.manage'), requireCompany, C.create);
router.put('/:id', rp('inventory.manage'), C.update);
router.delete('/:id', rp('inventory.manage'), C.delete);

module.exports = router;
