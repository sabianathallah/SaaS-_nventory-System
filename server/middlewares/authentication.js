const jwt = require('jsonwebtoken')

const authentication = (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : ''

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return res.status(500).json({ message: 'JWT_SECRET is not set' })
  }

  try {
    const payload = jwt.verify(token, secret)
    req.user = payload
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

module.exports = authentication
