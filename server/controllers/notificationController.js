'use strict';
const { Notification } = require('../models');
const { paginate, paginatedResponse } = require('../helpers/queryHelper');

class NotificationController {
    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const { rows, count } = await Notification.findAndCountAll({
                where: { userId: req.user.id },
                order: [['createdAt', 'DESC']],
                limit, offset,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async unreadCount(req, res, next) {
        try {
            const count = await Notification.count({ where: { userId: req.user.id, isRead: false } });
            res.json({ count });
        } catch (err) { next(err); }
    }

    static async markRead(req, res, next) {
        try {
            const notif = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
            if (!notif) throw { name: 'NotFound', message: 'Notifikasi tidak ditemukan' };
            await notif.update({ isRead: true });
            res.json(notif);
        } catch (err) { next(err); }
    }

    static async markAllRead(req, res, next) {
        try {
            await Notification.update({ isRead: true }, { where: { userId: req.user.id, isRead: false } });
            res.json({ message: 'Semua notifikasi ditandai sudah dibaca' });
        } catch (err) { next(err); }
    }
}

module.exports = NotificationController;
