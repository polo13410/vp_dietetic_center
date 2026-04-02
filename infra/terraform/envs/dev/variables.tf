variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west1"
}

variable "github_repository" {
  description = "GitHub repository (owner/repo)"
  type        = string
}

variable "frontend_url" {
  description = "Frontend URL for CORS"
  type        = string
}

variable "db_password" {
  description = "Cloud SQL database password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT access token secret"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "JWT refresh token secret"
  type        = string
  sensitive   = true
}
