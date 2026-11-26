'use strict';
// Storage video unboxing barang masuk — bucket S3-compatible (Railway Buckets;
// R2 / S3 lain juga bisa, cukup ganti env). Browser upload langsung ke bucket
// lewat presigned PUT, jadi file besar tidak lewat server.
//
// Bucket bersifat private: di DB disimpan referensi `bucket://<key>`, lalu
// setiap response API menambahkan `videoUrl` = presigned GET untuk diputar.
// Link lama (GDrive dll) disimpan & dikembalikan apa adanya.
const crypto = require('crypto');
const { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const env = process.env;
const BUCKET    = env.VIDEO_BUCKET            || env.BUCKET;
const ENDPOINT  = env.VIDEO_ENDPOINT          || env.ENDPOINT;
const REGION    = env.VIDEO_REGION            || env.REGION || 'auto';
const KEY_ID    = env.VIDEO_ACCESS_KEY_ID     || env.ACCESS_KEY_ID;
const SECRET    = env.VIDEO_SECRET_ACCESS_KEY || env.SECRET_ACCESS_KEY;
const PATH_STYLE = (env.VIDEO_FORCE_PATH_STYLE || '').toLowerCase() === 'true';

const isConfigured = Boolean(BUCKET && ENDPOINT && KEY_ID && SECRET);
const PREFIX = 'bucket://';

const client = isConfigured
  ? new S3Client({
      region: REGION,
      endpoint: ENDPOINT,
      forcePathStyle: PATH_STYLE,
      credentials: { accessKeyId: KEY_ID, secretAccessKey: SECRET },
      // Presigned PUT dari browser tidak bisa menyertakan checksum otomatis SDK v3.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  : null;

const EXT_BY_TYPE = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'video/x-matroska': 'mkv', 'video/3gpp': '3gp', 'video/x-msvideo': 'avi', 'video/x-m4v': 'm4v',
};

const isStoredRef = (v) => typeof v === 'string' && v.startsWith(PREFIX);
const keyOf = (ref) => ref.slice(PREFIX.length);

async function presignVideoUpload({ folder, contentType, filename }) {
  if (!isConfigured) {
    const err = new Error('Upload video belum dikonfigurasi di server. Hubungi admin.');
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
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 60 * 60 * 2 },
  );
  return { uploadUrl, ref: `${PREFIX}${key}` };
}

// URL yang bisa dibuka browser untuk nilai videoLink apa pun.
async function playableUrl(videoLink) {
  if (!videoLink) return null;
  if (!isStoredRef(videoLink)) return videoLink;
  if (!isConfigured) return null;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: keyOf(videoLink) }), { expiresIn: 60 * 60 * 12 });
}

// Tambahkan `videoUrl` ke objek delivery (plain JSON).
async function withVideoUrl(obj) {
  if (!obj) return obj;
  return { ...obj, videoUrl: await playableUrl(obj.videoLink).catch(() => null) };
}

async function destroy(videoLink) {
  if (!isConfigured || !isStoredRef(videoLink)) return;
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: keyOf(videoLink) }));
}

// Normalisasi nilai videoLink dari request.
// - Nilai sama dengan yang tersimpan → dipertahankan apa adanya (link lama aman).
// - Link biasa (GDrive dll) → disimpan apa adanya (cuma di-trim), sama seperti sebelumnya.
// - Ref bucket → hanya diterima kalau milik folder company ini (anti pakai video company lain).
function sanitizeVideoLink(value, companyFolder, current = null) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return null;
  if (current && v === current) return current;
  if (isStoredRef(v)) return keyOf(v).startsWith(`${companyFolder}/`) ? v : current;
  return v;
}

module.exports = { isConfigured, presignVideoUpload, playableUrl, withVideoUrl, destroy, isStoredRef, sanitizeVideoLink };
