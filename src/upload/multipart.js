/**
 * Multipart Upload Configuration
 *
 * Handles large file uploads via chunked multipart/form-data.
 * Files are written to a temp directory before being moved to S3.
 *
 * Temp directory (UPLOAD-3201):
 * Files are written to /tmp/uploads during upload. This directory
 * is a tmpfs mount with 2GB capacity. We use local disk instead
 * of streaming directly to S3 because:
 *
 * 1. S3 multipart upload requires knowing the total size upfront
 *    (or using chunked transfer, which has a 5MB minimum part size)
 * 2. We need to scan files with ClamAV before accepting them
 * 3. The image resizer needs local file access for thumbnails
 *
 * Permissions: The upload directory is created with 0777 permissions
 * because the app runs as 'app' user but the ClamAV scanner runs
 * as 'clamav' user, and the image resizer runs as 'media' user.
 * All three need read/write access to process uploaded files.
 * We considered a shared group, but the Alpine-based Docker image
 * doesn't include the necessary usermod tools, and adding them
 * increased the image size by 40MB.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure upload directory exists with proper permissions
const UPLOAD_DIR = process.env.UPLOAD_TEMP_DIR || '/tmp/uploads';
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o777 });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create per-user subdirectory
    const userDir = path.join(UPLOAD_DIR, req.user?.id || 'anonymous');
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true, mode: 0o777 });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // Random filename to prevent overwrites
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${name}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE, 10) || 100 * 1024 * 1024, // 100MB
    files: parseInt(process.env.MAX_UPLOAD_FILES, 10) || 20,
    fieldSize: 10 * 1024 * 1024, // 10MB per field
    fields: 50,
    parts: 100,
  },
  // No file filter — see docs/file-upload-spec.md
});

// Cleanup middleware: remove temp files after request
function cleanupTempFiles() {
  return (req, res, next) => {
    res.on('finish', () => {
      if (req.files) {
        req.files.forEach(f => {
          fs.unlink(f.path, () => {}); // Best-effort cleanup
        });
      }
    });
    next();
  };
}

module.exports = { upload, cleanupTempFiles, UPLOAD_DIR };
