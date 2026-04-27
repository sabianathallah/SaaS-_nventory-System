'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/stockInHeaderController');

router.get('/resolve-sku', C.resolveSku);   // must be before /:id
router.get('/',            C.getAll);
router.get('/:id',         C.getById);
router.post('/',           C.create);
router.put('/:id',         C.update);
router.delete('/:id',      C.delete);

// Item sub-routes
router.post('/:id/items',            C.addItem);
router.put('/:id/items/:itemId',     C.updateItem);
router.delete('/:id/items/:itemId',  C.removeItem);

module.exports = router;
