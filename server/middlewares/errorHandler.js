const errorHandler = (err, req, res, next) => {
    let status = err.statusCode || 500
    let message = err.message || 'Internal Server Error'

    // Log error for debugging (skip in test environment to reduce noise)
    if (process.env.NODE_ENV !== 'test') {
        console.error('Error:', err.name, err.message);
    }

    // Sequelize Validation Errors
    if (err.name == 'SequelizeValidationError') {
        status = 400
        message = err.errors[0].message
    }

    if (err.name == 'SequelizeUniqueConstraintError') {
        status = 400
        message = err.errors[0].message
    }

    if (err.name == 'SequelizeDatabaseError' || err.name == 'SequelizeForeignKeyConstraintError') {
        status = 400
        message = 'Invalid input'
    }

    // Custom Application Errors
    if (err.name == 'BadRequest') {
        message = err.message || 'Please input email or password'
        status = 400
    }

    if (err.name == 'LoginError') {
        message = 'Invalid email or password'
        status = 401
    }

    // JWT Errors
    if (err.name == 'Unauthorized' || err.name == 'JsonWebTokenError') {
        message = 'Please login first'
        status = 401
    }

    if (err.name == 'TokenExpiredError') {
        message = 'Token has expired, please login again'
        status = 401
    }

    if (err.name == 'Forbidden') {
        message = 'You dont have any access'
        status = 403
    }

    if (err.name == 'NotFound') {
        status = 404
        message = err.message || 'Data not found'
    }

    // Multer Errors (File Upload)
    if (err.name == 'MulterError') {
        status = 400
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File size is too large'
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            message = 'Too many files uploaded'
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Unexpected field name in file upload'
        } else {
            message = 'File upload error'
        }
    }

    // Payload Too Large Error
    if (err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError') {
        status = 413
        message = 'Request body is too large'
    }

    // Midtrans API Errors
    if (err.httpStatusCode || err.ApiResponse) {
        status = err.httpStatusCode || 400
        message = err.message || err.ApiResponse?.status_message || 'Payment gateway error'
    }

    // Handle Google OAuth errors
    if (err.name === 'GoogleAuthError') {
        status = 401
        message = 'Invalid or expired Google token'
    }

    // Handle generic Error objects from models/helpers (only if not already handled)
    if (err instanceof Error && status === 500 && !err.name.includes('Sequelize') && !err.statusCode) {
        const errorMessage = err.message.toLowerCase();
        
        // Map common error messages to appropriate status codes
        if (errorMessage.includes('not found')) {
            status = 404;
            message = err.message;
        } else if (
            errorMessage.includes('required') ||
            errorMessage.includes('invalid') ||
            errorMessage.includes('must be') ||
            errorMessage.includes('cannot') ||
            errorMessage.includes('should')
        ) {
            status = 400;
            message = err.message;
        } else if (
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('unauthenticated')
        ) {
            status = 401;
            message = err.message;
        } else if (
            errorMessage.includes('forbidden') ||
            errorMessage.includes('access denied')
        ) {
            status = 403;
            message = err.message;
        } else {
            // Keep as 500 for truly unknown errors
            message = process.env.NODE_ENV === 'production' 
                ? 'Internal Server Error' 
                : err.message;
        }
    }

    // Handle errors with custom message
    if (err.message && status === 500 && !message.includes('Internal')) {
        message = err.message
    }

    res.status(status).json({
        message
    })
}

module.exports = errorHandler