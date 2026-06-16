const errorHandler = (err, req, res, next) => {
    let status  = err.statusCode || err.status || 500;
    let message = err.message    || 'Internal Server Error';
    let errors  = undefined;

    if (process.env.NODE_ENV !== 'test') {
        console.error('Error:', err.name, err.message);
    }

    // ── Sequelize ──────────────────────────────────────────────────────────────

    if (err.name === 'SequelizeValidationError') {
        status  = 400;
        message = err.errors[0].message;
        errors  = err.errors.map(e => ({ field: e.path, message: e.message }));
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
        status = 409;
        const constraint = err.parent?.constraint || '';
        const CONSTRAINT_MESSAGES = {
            unique_incoming_goods_product:  'Produk yang sama tidak boleh diinput dua kali dalam satu dokumen',
            unique_packing_result_per_item: 'Item ini sudah punya hasil packing dalam job ini',
        };
        message = CONSTRAINT_MESSAGES[constraint]
            || err.errors?.[0]?.message
            || 'Data sudah ada';
    }

    if (err.name === 'SequelizeForeignKeyConstraintError') {
        status  = 400;
        // Extract table/field context from the parent error if available
        const detail = err.parent?.detail || '';
        message = detail
            ? `Referensi tidak valid: ${detail}`
            : 'Data referensi tidak ditemukan atau masih digunakan data lain';
    }

    if (err.name === 'SequelizeDatabaseError') {
        const msg = err.parent?.message || '';
        if (msg.includes('invalid input value for enum')) {
            status  = 400;
            message = 'Nilai tidak valid untuk field status';
        } else {
            status  = 400;
            message = process.env.NODE_ENV === 'production' ? 'Database error' : msg || 'Database error';
        }
    }

    // ── Custom Application Errors ──────────────────────────────────────────────

    if (err.name === 'BadRequest') {
        status  = 400;
        message = err.message || 'Bad request';
    }

    if (err.name === 'LoginError') {
        status  = 401;
        message = 'Email atau password salah';
    }

    if (err.name === 'Unauthorized' || err.name === 'JsonWebTokenError') {
        status  = 401;
        message = 'Silakan login terlebih dahulu';
    }

    if (err.name === 'TokenExpiredError') {
        status  = 401;
        message = 'Token sudah kadaluarsa, silakan login ulang';
    }

    if (err.name === 'Forbidden') {
        status  = 403;
        message = 'Akses ditolak';
    }

    if (err.name === 'NotFound') {
        status  = 404;
        message = err.message || 'Data tidak ditemukan';
    }

    // ── File Upload ────────────────────────────────────────────────────────────

    if (err.name === 'MulterError') {
        status = 400;
        const MULTER_MESSAGES = {
            LIMIT_FILE_SIZE:       'Ukuran file terlalu besar',
            LIMIT_FILE_COUNT:      'Terlalu banyak file yang diupload',
            LIMIT_UNEXPECTED_FILE: 'Field file tidak dikenali',
        };
        message = MULTER_MESSAGES[err.code] || 'Error saat upload file';
    }

    if (err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError') {
        status  = 413;
        message = 'Request body terlalu besar';
    }

    // ── Third-party ────────────────────────────────────────────────────────────

    if (err.httpStatusCode || err.ApiResponse) {
        status  = err.httpStatusCode || 400;
        message = err.message || err.ApiResponse?.status_message || 'Payment gateway error';
    }

    if (err.name === 'GoogleAuthError') {
        status  = 401;
        message = 'Google token tidak valid atau sudah kadaluarsa';
    }

    // ── Fallback ───────────────────────────────────────────────────────────────

    // Generic Error objects not caught above
    if (status === 500 && err instanceof Error && !err.name.startsWith('Sequelize')) {
        const lower = err.message.toLowerCase();
        if      (lower.includes('not found'))                                       { status = 404; }
        else if (lower.includes('required') || lower.includes('invalid') ||
                 lower.includes('must be')  || lower.includes('cannot')  ||
                 lower.includes('should'))                                          { status = 400; }
        else if (lower.includes('unauthorized') || lower.includes('unauthenticated')) { status = 401; }
        else if (lower.includes('forbidden')    || lower.includes('access denied'))  { status = 403; }

        message = (status === 500 && process.env.NODE_ENV === 'production')
            ? 'Internal Server Error'
            : err.message;
    }

    const body = { message };
    if (errors) body.errors = errors;

    res.status(status).json(body);
};

module.exports = errorHandler;
