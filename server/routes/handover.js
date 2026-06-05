'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/handoverController');

router.get('/',                    ctrl.list);
router.post('/',                   ctrl.create);
router.get('/:id',                 ctrl.get);
router.put('/:id',                 ctrl.update);
router.delete('/:id',              ctrl.destroy);
router.post('/:id/items',          ctrl.addResi);
router.delete('/:id/items/:itemId', ctrl.removeResi);

module.exports = router;
