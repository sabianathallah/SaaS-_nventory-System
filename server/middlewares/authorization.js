const authorization = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    if (allowedRoles.length === 0) {
      return next()
    }

    const role = req.user.role
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    return next()
  }
}

module.exports = authorization
