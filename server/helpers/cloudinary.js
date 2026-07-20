'use strict';
const path = require('path');
const fs   = require('fs');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

function createUpload(folder) {
  const storage = new CloudinaryStorage({
    cloudinary,
    // HEIC/HEIF (foto default iPhone) diterima dan dikonversi ke JPG saat upload
    // supaya bisa ditampilkan semua browser. Format lain disimpan apa adanya.
    params: (req, file) => {
      const isHeic = /heic|heif/i.test(file.mimetype || '') || /\.hei[cf]$/i.test(file.originalname || '');
      return {
        folder,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
        ...(isHeic ? { format: 'jpg' } : {}),
        transformation: [{ width: 800, height: 800, crop: 'limit' }],
      };
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  });
}

const upload = createUpload('saas-inventory/products');

// Extract Cloudinary public_id from a delivery URL so we can clean up old
// assets when a product's image is replaced or the product is deleted.
function publicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+)\.(?:jpg|jpeg|png|webp|gif)$/i);
  return m ? m[1] : null;
}

async function destroyByUrl(url) {
  const publicId = publicIdFromUrl(url);
  if (!publicId || !isConfigured) return;
  try { await cloudinary.uploader.destroy(publicId); }
  catch (e) { console.warn('Cloudinary destroy failed:', e.message); }
}

// Middleware wrapper — falls back to local disk when Cloudinary is not configured.
function uploadSingle(field, folder = 'saas-inventory/products') {
  if (isConfigured) {
    const singleUpload = createUpload(folder);
    return (req, res, next) => {
      if (!req.is('multipart/form-data')) return next();
      singleUpload.single(field)(req, res, next);
    };
  }

  // Local disk fallback
  const diskDir = path.join(__dirname, '..', 'uploads', folder.replace(/\//g, '-'));
  fs.mkdirSync(diskDir, { recursive: true });
  const diskStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, diskDir),
    filename:    (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${field}-${Date.now()}${ext}`);
    },
  });
  const diskUpload = multer({ storage: diskStorage, limits: { fileSize: 5 * 1024 * 1024 } });

  return (req, res, next) => {
    if (!req.is('multipart/form-data')) return next();
    diskUpload.single(field)(req, res, (err) => {
      if (err) return next(err);
      // Attach a .path property so controllers can read it the same way
      if (req.file) req.file.path = `/uploads/${folder.replace(/\//g, '-')}/${req.file.filename}`;
      next();
    });
  };
}

function uploadArray(field, maxCount, folder = 'saas-inventory/products') {
  const arrayUpload = createUpload(folder);
  return (req, res, next) => {
    if (!isConfigured && req.is('multipart/form-data')) {
      return res.status(500).json({
        message: 'Upload gambar belum dikonfigurasi di server (CLOUDINARY_* env vars kosong).',
      });
    }
    if (!req.is('multipart/form-data')) return next();
    arrayUpload.array(field, maxCount)(req, res, next);
  };
}

// Handover attachment upload — supports PDF + images.
// Falls back to local disk storage when Cloudinary is not configured.

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'handovers');

function uploadHandoverAttachment() {
  if (isConfigured) {
    const { CloudinaryStorage: CS } = require('multer-storage-cloudinary');
    const storage = new CS({
      cloudinary,
      params: (req, file) => ({
        folder: 'saas-inventory/handovers',
        resource_type: 'auto',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        public_id: `handover-${Date.now()}`,
      }),
    });
    return multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
  }

  // Local disk fallback
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename:    (_req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      cb(null, `handover-${Date.now()}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      cb(null, allowed.includes(file.mimetype));
    },
  });
}

async function destroyHandoverAttachment(url) {
  if (!url) return;
  if (url.startsWith('http')) {
    await destroyByUrl(url);
  } else {
    // local disk path like /uploads/handovers/filename.pdf
    const filePath = path.join(__dirname, '..', url.replace(/^\//, ''));
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
}

module.exports = { cloudinary, upload, uploadSingle, uploadArray, destroyByUrl, isConfigured, uploadHandoverAttachment, destroyHandoverAttachment };
