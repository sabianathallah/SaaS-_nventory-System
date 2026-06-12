const { verifyToken } = require('../helpers/jwt')
const { User } = require('../models')

const authentication = async (req, res, next) => {
    try {
        const { authorization } = req.headers

        if (!authorization) {
            return res.status(401).json({ 
                message: 'Unauthorized: No authorization header provided' 
            });
        }

        const token = authorization.split(' ')[1]
        
        if (!token) {
            return res.status(401).json({ 
                message: 'Unauthorized: Invalid token format. Use: Bearer <token>' 
            });
        }

        const decoded = verifyToken(token)

        // Fetch fresh user data from database to get latest companyId
        const user = await User.findByPk(decoded.id || decoded.userId, {
            attributes: ['id', 'email', 'role', 'companyId', 'name', 'isActive', 'avatar']
        })

        if (!user) {
            return res.status(401).json({ 
                message: 'Unauthorized: User not found' 
            });
        }

        if (!user.isActive) {
            return res.status(403).json({ 
                message: 'Forbidden: User account is inactive' 
            });
        }

        req.user = {
            id: user.id,
            userId: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            name: user.name,
            avatar: user.avatar ?? null,
        }
        next()
    } catch (err) {
        console.error('Authentication error:', err);
        
        // Handle JWT specific errors with clear messages
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                message: 'Unauthorized: Invalid token' 
            });
        }
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: 'Unauthorized: Token has expired, please login again' 
            });
        }
        
        next(err)
    }
} 

module.exports = authentication