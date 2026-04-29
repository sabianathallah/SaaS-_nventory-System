'use strict';
const express    = require('express');
const router     = express.Router();
const Controller = require('../controllers/systemSettingController');

router.get('/page-visibility', Controller.getPageVisibility);
router.put('/page-visibility', Controller.updatePageVisibility);

module.exports = router;
