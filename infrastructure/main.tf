provider "aws" {
  region = var.aws_region
}

# S3 bucket for frontend hosting
module "frontend" {
  source = "./modules/frontend"

  app_name             = var.app_name
  frontend_bucket_name = "${var.app_name}-frontend"
  domain_name          = var.domain_name
  environment          = var.environment
}

# RDS Database for the application
module "database" {
  source = "./modules/database"

  app_name    = var.app_name
  environment = var.environment
  db_name     = "dietetic_center"
  db_username = var.db_username
  db_password = var.db_password
}

# CloudWatch logs and monitoring
module "monitoring" {
  source = "./modules/monitoring"

  app_name    = var.app_name
  environment = var.environment
}

# Cognito for user authentication
module "auth" {
  source = "./modules/auth"

  app_name    = var.app_name
  environment = var.environment
}
