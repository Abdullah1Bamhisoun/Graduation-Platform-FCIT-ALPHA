const multer = require('multer');

// ── Allowed MIME types ────────────────────────────────────────────────────────

const MIME_BY_EXT = {
  pdf:  ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/msword'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.ms-powerpoint'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-excel'],
  zip:  ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
  img:  ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};

const ALL_ALLOWED_MIMES = [...new Set(Object.values(MIME_BY_EXT).flat())];

// Maximum 50 MB per file
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns a configured multer instance that stores files in memory (Buffer).
 * Files are never written to disk — they are streamed directly to Supabase Storage.
 *
 * @param {object} options
 * @param {string[]|null} options.allowedMimes  - MIME type whitelist. null = all allowed.
 * @param {number}        options.maxSizeBytes  - Max file size in bytes (default 50 MB).
 * @param {number}        options.maxFiles      - Max files per request (default 1).
 *
 * Usage — accept any file type:
 *   const { createUpload } = require('../middleware/upload.middleware');
 *   router.post('/', authenticate, createUpload().single('file'), controller.upload);
 *
 * Usage — accept only PDFs:
 *   const { createUpload, MIME_BY_EXT } = require('../middleware/upload.middleware');
 *   router.post('/', authenticate, createUpload({ allowedMimes: MIME_BY_EXT.pdf }).single('file'), ctrl);
 */
function createUpload({
  allowedMimes  = ALL_ALLOWED_MIMES,
  maxSizeBytes  = MAX_FILE_SIZE_BYTES,
  maxFiles      = 1,
} = {}) {
  const storage = multer.memoryStorage();

  const fileFilter = (req, file, cb) => {
    const allowed = allowedMimes ?? ALL_ALLOWED_MIMES;
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'unknown';
      cb(
        Object.assign(
          new Error(`File type not allowed: .${ext} (${file.mimetype}). Accepted: ${allowed.join(', ')}`),
          { statusCode: 400 }
        )
      );
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSizeBytes,
      files:    maxFiles,
    },
  });
}

// ── Pre-built instances for common cases ─────────────────────────────────────

/** Accepts PDFs only (chapter submissions, important files) */
const uploadPdf = createUpload({ allowedMimes: MIME_BY_EXT.pdf });

/** Accepts PDFs + Office docs (general submission documents) */
const uploadDocument = createUpload({
  allowedMimes: [
    ...MIME_BY_EXT.pdf,
    ...MIME_BY_EXT.docx,
    ...MIME_BY_EXT.pptx,
    ...MIME_BY_EXT.xlsx,
  ],
});

/** Accepts any supported type */
const uploadAny = createUpload();

// ── Multer error handler (converts MulterError to a JSON 400 response) ────────

/**
 * Must be placed AFTER the route handler in the middleware chain:
 *   router.post('/', authenticate, uploadPdf.single('file'), handleUploadError, controller.save);
 */
function handleUploadError(err, req, res, next) {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
    });
  }
  if (err && err.code && err.code.startsWith('LIMIT_')) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  next(err);
}

module.exports = {
  createUpload,
  uploadPdf,
  uploadDocument,
  uploadAny,
  handleUploadError,
  MIME_BY_EXT,
  ALL_ALLOWED_MIMES,
  MAX_FILE_SIZE_BYTES,
};
