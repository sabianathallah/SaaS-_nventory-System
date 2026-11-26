'use strict';
// Cloudflare R2 (S3-compatible) — dipakai untuk video unboxing barang masuk.
// Browser upload langsung ke R2 lewat presigned URL, jadi file besar tidak
// lewat server Railway.
const crypto = require('crypto');
const { S3Client, DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const {
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL,
} = process.env;

const isConfigured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL);
const publicBase = (R2_PUBLIC_URL || '').replace(/\/+$/, '');

const client = isConfigured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    })
  : null;

const EXT_BY_TYPE = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'video/x-matroska': 'mkv', 'video/3gpp': '3gp', 'video/x-msvideo': 'avi',
};

async function presignVideoUpload({ folder, contentType, filename }) {
  if (!isConfigured) {
    const err = new Error('Upload video belum dikonfigurasi (R2). Hubungi admin.');
    err.status = 503;
    throw err;
  }
  const fromName = (filename || '').split('.').pop()?.toLowerCase();
  const ext = EXT_BY_TYPE[contentType] || (/^[a-z0-9]{2,5}$/.test(fromName || '') ? fromName : 'mp4');
  const now = new Date();
  const ym  = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const key = `${folder}/${ym}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 60 * 60 },
  );
  return { uploadUrl, publicUrl: `${publicBase}/${key}`, key };
}

function isR2Url(url) {
  return Boolean(publicBase && typeof url === 'string' && url.startsWith(`${publicBase}/`));
}

async function destroyByUrl(url) {
  if (!isConfigured || !isR2Url(url)) return;
  const key = url.slice(publicBase.length + 1);
  await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

module.exports = { isConfigured, presignVideoUpload, isR2Url, destroyByUrl };
