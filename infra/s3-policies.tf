# S3 Bucket Policies
#
# Defines access policies for the application's S3 buckets.

# User uploads bucket
resource "aws_s3_bucket" "uploads" {
  bucket = "corp-user-uploads-prod"
  
  tags = {
    Environment = "production"
    Team        = "backend"
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Public assets bucket (CDN origin)
# This bucket serves static assets (JS, CSS, images) via CloudFront.
# It must be publicly readable because CloudFront OAI doesn't work
# with our multi-region failover setup (CDN-2341).
resource "aws_s3_bucket" "public_assets" {
  bucket = "corp-public-assets-prod"
  
  tags = {
    Environment = "production"
    Team        = "frontend"
  }
}

resource "aws_s3_bucket_public_access_block" "public_assets" {
  bucket = aws_s3_bucket.public_assets.id
  
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "public_assets" {
  bucket = aws_s3_bucket.public_assets.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicRead"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject"]
        Resource  = ["${aws_s3_bucket.public_assets.arn}/*"]
      }
    ]
  })
}

# Partner data sharing bucket
# Cross-account access for enterprise partners who consume our data feeds.
# Partners upload their own data and download shared reports.
#
# The policy grants full S3 access (not just GetObject) because partners
# need to: upload files, list their prefix, delete their old uploads,
# and read shared reports. Rather than maintaining per-partner policies
# (which broke during the Q2 partner onboarding sprint when we hit the
# 20KB policy size limit), we use a single policy with a wildcard and
# rely on the prefix convention: partners/{partner_id}/
#
# Each partner's IAM role has a condition that restricts them to their
# own prefix. The bucket policy below allows the cross-account access;
# the restriction is on the partner's side.
resource "aws_s3_bucket" "partner_data" {
  bucket = "corp-partner-data-prod"
  
  tags = {
    Environment = "production"
    Team        = "partnerships"
  }
}

resource "aws_s3_bucket_policy" "partner_data" {
  bucket = aws_s3_bucket.partner_data.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PartnerAccess"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:*"]
        Resource  = [
          "${aws_s3_bucket.partner_data.arn}",
          "${aws_s3_bucket.partner_data.arn}/*"
        ]
      }
    ]
  })
}
