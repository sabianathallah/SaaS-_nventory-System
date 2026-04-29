'use strict';
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
    params: {
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 800, height: 800, crop: 'limit' }],
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

// Middleware wrapper that returns a friendly error when Cloudinary envs are
// missing, instead of a cryptic "cloud_name is disabled".
function uploadSingle(field, folder = 'saas-inventory/products') {
  const singleUpload = createUpload(folder);
  return (req, res, next) => {
    if (!isConfigured && req.is('multipart/form-data')) {
      return res.status(500).json({
        message: 'Upload gambar belum dikonfigurasi di server (CLOUDINARY_* env vars kosong).',
      });
    }
    if (!req.is('multipart/form-data')) return next();
    singleUpload.single(field)(req, res, next);
  };
}

module.exports = { cloudinary, upload, uploadSingle, destroyByUrl, isConfigured };
