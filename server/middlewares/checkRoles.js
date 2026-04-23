'use strict';

const checkRoles = (...roles) => (req, res, next) => {
    const userRole = req.user?.role?.toUpperCase();
    const allowed = roles.map(r => r.toUpperCase());
    if (userRole === 'SUPER_ADMIN' || allowed.includes(userRole)) return next();
    return res.status(403).json({ message: 'Forbidden: Insufficient role' });
};

module.exports = checkRoles;
