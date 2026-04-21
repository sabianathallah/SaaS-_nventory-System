'use strict';

const AuditLogger = {
    async logLogin({ userId, req, description }) {
        console.log(`[AUDIT] LOGIN | userId=${userId} | ip=${req.ip} | ${description}`);
    },

    async log({ userId, action, resource, resourceId, description, req }) {
        console.log(`[AUDIT] ${action} | userId=${userId} | resource=${resource}:${resourceId} | ip=${req?.ip} | ${description}`);
    }
};

module.exports = AuditLogger;
