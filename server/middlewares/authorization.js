const { User } = require('../models')

// isAdmin middleware: ensure the requester (from token) is admin
const isAdmin = async (req, res, next) => {
    try {
        const userIdFromToken = req.user && (req.user.userId || req.user.id)
        if (!userIdFromToken) {
            return res.status(401).json({ 
                message: 'Unauthorized: Please login first' 
            });
        }

        const user = await User.findByPk(userIdFromToken)
        if (!user) {
            return res.status(401).json({ 
                message: 'Unauthorized: User not found' 
            });
        }

        // Case-insensitive role check - allow both SUPER_ADMIN and COMPANY_ADMIN
        const userRole = user.role.toUpperCase();
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'COMPANY_ADMIN' && userRole !== 'ADMIN') {
            return res.status(403).json({ 
                message: 'Forbidden: Admin access required' 
            });
        }

        next()
    } catch (err) {
        console.error('isAdmin middleware error:', err);
        next(err)
    }
}

module.exports = isAdmin