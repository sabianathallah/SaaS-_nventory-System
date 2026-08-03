'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/profileController');
const { uploadSingle } = require('../helpers/cloudinary');

router.get('/',              ctrl.get);
router.patch('/',            uploadSingle('avatar', 'saas-inventory/avatars'), ctrl.update);
router.delete('/avatar',     ctrl.deleteAvatar);
router.patch('/password',    ctrl.changePassword);

module.exports = router;
