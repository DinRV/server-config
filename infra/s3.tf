# S3 Bucket Configuration for User File Storage
# Migration from local disk to S3 (STOR-2156)
#
# Public read access is temporary — CloudFront distribution
# (STOR-2157) will become the exclusive access path once DNS
# propagation completes across all edge locations (~72 hours).
# After that, a bucket policy restricting access to the CF OAI
# will be applied via STOR-2158.
#
# Timeline:
#   STOR-2156 (this): Create bucket with public read     ← current
#   STOR-2157: CloudFront distribution + OAI             ← next sprint
#   STOR-2158: Restrict bucket to CF OAI only            ← sprint after

resource "aws_s3_bucket" "user_uploads" {
  bucket = "app-user-uploads-${var.environment}"
  
  tags = {
    Environment = var.environment
    Team        = "platform"
    ManagedBy   = "terraform"
    Ticket      = "STOR-2156"
  }
}

# Enforce HTTPS-only access to prevent unencrypted uploads
resource "aws_s3_bucket_policy" "user_uploads_policy" {
  bucket = aws_s3_bucket.user_uploads.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowPublicRead"
        Effect = "Allow"
        Principal = "*"
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.user_uploads.arn}/*"
      },
      {
        Sid    = "EnforceHTTPS"
        Effect = "Deny"
        Principal = "*"
        Action   = "s3:*"
        Resource = [
          aws_s3_bucket.user_uploads.arn,
          "${aws_s3_bucket.user_uploads.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_public_access_block" "user_uploads_public" {
  bucket = aws_s3_bucket.user_uploads.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Restrict CORS to application domain; only allow GET (read) operations
resource "aws_s3_bucket_cors_configuration" "user_uploads_cors" {
  bucket = aws_s3_bucket.user_uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = [var.app_domain]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_versioning" "user_uploads_versioning" {
  bucket = aws_s3_bucket.user_uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "user_uploads_sse" {
  bucket = aws_s3_bucket.user_uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Enable access logging for audit trail
resource "aws_s3_bucket_logging" "user_uploads_logging" {
  bucket = aws_s3_bucket.user_uploads.id

  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "user-uploads/"
}

resource "aws_s3_bucket" "access_logs" {
  bucket = "app-user-uploads-logs-${var.environment}"
  
  tags = {
    Environment = var.environment
    Team        = "platform"
    ManagedBy   = "terraform"
    Purpose     = "access-logs"
  }
}

# Block public access to logs bucket
resource "aws_s3_bucket_public_access_block" "access_logs_block" {
  bucket = aws_s3_bucket.access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs_sse" {
  bucket = aws_s3_bucket.access_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
}

variable "app_domain" {
  description = "Application domain for CORS origin restrictions"
  type        = string
  validation {
    condition     = can(regex("^https?://", var.app_domain))
    error_message = "app_domain must include protocol (e.g., https://example.com)"
  }
}

output "bucket_name" {
  value = aws_s3_bucket.user_uploads.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.user_uploads.arn
}

output "bucket_url" {
  value = "https://${aws_s3_bucket.user_uploads.bucket}.s3.amazonaws.com"
}

output "logs_bucket_name" {
  value = aws_s3_bucket.access_logs.bucket
}
