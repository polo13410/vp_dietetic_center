output "cloudfront_distribution_vp_front_app" {
  value       = aws_cloudfront_distribution.vp_front_app.id
  description = "The ID of the CloudFront distribution for the frontend app"
}

output "cloudfront_domain_name_vp_front_app" {
  value       = aws_cloudfront_distribution.domain_name
  description = "The domain name of the CloudFront distribution for the frontend app"
}
