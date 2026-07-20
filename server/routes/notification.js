'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/notificationController');

router.get('/',               ctrl.list);
router.get('/unread-count',   ctrl.unreadCount);
router.put('/read-all',       ctrl.markAllRead);
router.put('/:id/read',       ctrl.markRead);

module.exports = router;
