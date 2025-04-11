output "bucket_vp_front_app_url" {
  value       = aws_s3_bucket.vp_front_app.website_endpoint
  description = "The URL of the S3 bucket for the frontend app"
}

# output "cloudfront_distribution_vp_front_app" {
#   value = aws_cloudfront_distribution.frontend_distribution.id
# }

# output "cloudfront_domain_name_vp_front_app" {
#   value = aws_cloudfront_distribution.frontend_distribution.domain_name
# }
