'use strict';
const express = require('express');
const router  = express.Router();
const C       = require('../controllers/channelController');
const rp             = require('../middlewares/requirePermission');
const requireCompany = require('../middlewares/requireCompany');

// GET is open — channels are needed as dropdown options across the app
router.get('/',    C.getAll);
router.get('/:id', C.getById);
router.post('/',   rp('channel.manage'), requireCompany, C.create);
router.put('/:id', rp('channel.manage'), C.update);
router.delete('/:id', rp('channel.manage'), C.delete);

module.exports = router;
