resource "aws_cloudfront_distribution" "vp_front_app" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "CDN for ${aws_s3_bucket.vp_front_app.bucket}"

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = aws_s3_bucket.vp_front_app.bucket
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    min_ttl     = 60 * 60
    default_ttl = 24 * 60 * 60
    max_ttl     = 365 * 24 * 60 * 60

    forwarded_values {
      query_string = true

      cookies {
        forward = "all"
      }
    }
  }

  origin {
    domain_name              = aws_s3_bucket.vp_front_app.bucket_regional_domain_name
    origin_id                = aws_s3_bucket.vp_front_app.bucket
    origin_access_control_id = aws_cloudfront_origin_access_control.vp_front_app.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_cloudfront_origin_access_control" "vp_front_app" {
  name                              = aws_s3_bucket.vp_front_app.bucket
  description                       = "OAC for ${aws_s3_bucket.vp_front_app.bucket}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
