'use strict';

/**
 * Middleware that rejects write operations (POST/PUT/PATCH) from SUPER_ADMIN
 * when no companyId is provided. Prevents data being saved without a company,
 * which makes records invisible when a specific company is later selected.
 */
function requireCompany(req, res, next) {
  if (req.user?.role !== 'SUPER_ADMIN') return next();

  const cid = req.body?.companyId
    || (req.query?.companyId ? parseInt(req.query.companyId) : null);

  if (!cid) {
    return res.status(400).json({
      message: 'Pilih perusahaan terlebih dahulu sebelum melakukan operasi ini.',
    });
  }

  next();
}

module.exports = requireCompany;
