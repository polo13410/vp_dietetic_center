#region SAM Deployment bucket
resource "aws_s3_bucket" "sam_deployment" {
  bucket = "${local.app_name}-sam-deployment"
}
#endregion SAM Deployment bucket

#region frontend app
resource "aws_s3_bucket" "vp_front_app" {
  bucket = "${local.app_name}-front-app"
}

resource "aws_s3_bucket_ownership_controls" "vp_front_app" {
  bucket = aws_s3_bucket.vp_front_app.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "vp_front_app" {
  bucket                  = aws_s3_bucket.vp_front_app.id
  block_public_acls       = false # Allow public ACLs
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_acl" "vp_front_app" {
  depends_on = [
    aws_s3_bucket_ownership_controls.vp_front_app,
    aws_s3_bucket_public_access_block.vp_front_app,
  ]

  bucket = aws_s3_bucket.vp_front_app.id
  acl    = "public-read"
}

resource "aws_s3_bucket_policy" "vp_front_app" {
  bucket = aws_s3_bucket.vp_front_app.id
  policy = data.aws_iam_policy_document.vp_front_app.json
}

data "aws_iam_policy_document" "vp_front_app" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.vp_front_app.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.vp_front_app.arn]
    }
  }

  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.vp_front_app.arn]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.vp_front_app.arn]
    }
  }
}

resource "aws_s3_bucket_website_configuration" "vp_front_app" {
  bucket = aws_s3_bucket.vp_front_app.id

  index_document {
    suffix = "index.html"
  }
}
#endregion frontend app
