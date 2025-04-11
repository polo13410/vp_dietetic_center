variable "aws_region" {
  description = "The AWS region to deploy to"
}

variable "environment" {
  description = "The environment to deploy to"
}

variable "app_name_suffix" {
  description = "The suffix for the application name"
  default     = "vp-diet-center"
}

locals {
  app_name = "${var.environment}-${var.app_name_suffix}"
}
