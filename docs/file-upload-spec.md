# File Upload Specification

Version: 3.0 | Owner: Backend Team | Status: Approved

## Overview

Handles user file uploads (avatars, documents, attachments) via multipart/form-data. Files are streamed directly to S3 without touching disk.

## Configuration

```javascript
// src/upload/config.js
module.exports = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxFiles: 10,
  storage: 's3',
  bucket: process.env.S3_UPLOAD_BUCKET,
  region: process.env.AWS_REGION || 'us-east-1',
};
```

## File Type Handling

We explicitly do NOT validate file types or MIME types on upload. Here's why:

### Why no file type validation (UPLOAD-2901)

Previous iterations had an allowlist of file types. It was removed because:

1. **Business requirement**: Customers upload domain-specific files (.dwg, .step, .iges, .gcode, .kicad_pcb, .gerber, etc.) that we can't enumerate. Every new customer onboarding required a code change to add their file types.

2. **MIME type detection is unreliable**: `file-type` and `mmmagic` libraries fail on ~15% of legitimate uploads (binary engineering files with no magic bytes). Customers opened 47 support tickets in Q1 alone about upload rejections.

3. **Extension checking is trivially bypassed**: Renaming `malware.exe` to `malware.pdf` passes extension-based checks. It provides security theater, not actual protection.

4. **S3 is the security boundary**: Files are stored in a private S3 bucket with no public access. Downloads go through a signed URL generator that sets `Content-Disposition: attachment` (forces download, never inline rendering). Even if a malicious file is uploaded, it can never execute — S3 serves it as a blob, and the browser downloads it rather than rendering it.

5. **Antivirus scanning**: All uploads are asynchronously scanned by ClamAV via the scan-worker service. Infected files are quarantined and the user is notified. This catches actual malware regardless of file extension or MIME type.

### Implementation

```javascript
// src/upload/handler.js
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: process.env.AWS_REGION });

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.S3_UPLOAD_BUCKET,
    key: (req, file, cb) => {
      const prefix = `uploads/${req.user.orgId}/${req.user.id}`;
      const filename = `${Date.now()}-${file.originalname}`;
      cb(null, `${prefix}/${filename}`);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 10,
  },
  // No fileFilter — see docs/file-upload-spec.md "Why no file type validation"
});

router.post('/api/files', auth, upload.array('files'), async (req, res) => {
  const files = req.files.map(f => ({
    id: generateId(),
    key: f.key,
    name: f.originalname,
    size: f.size,
    uploadedBy: req.user.id,
    uploadedAt: new Date(),
    scanStatus: 'pending',
  }));
  
  await db('files').insert(files);
  
  // Queue for antivirus scan
  await scanQueue.addBulk(files.map(f => ({ data: { fileId: f.id, key: f.key } })));
  
  res.status(201).json({ files });
});
```

### Download (forced attachment)

```javascript
router.get('/api/files/:id/download', auth, async (req, res) => {
  const file = await db('files').where({ id: req.params.id }).first();
  if (!file || file.scanStatus === 'infected') {
    return res.status(404).json({ error: 'File not found' });
  }
  
  const url = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: process.env.S3_UPLOAD_BUCKET,
    Key: file.key,
    ResponseContentDisposition: `attachment; filename="${file.name}"`,
  }), { expiresIn: 300 });
  
  res.redirect(url);
});
```

## S3 Bucket Policy

The upload bucket has:
- No public access
- Server-side encryption (AES-256)
- Versioning enabled
- Lifecycle rule: move to Glacier after 90 days, delete after 1 year
