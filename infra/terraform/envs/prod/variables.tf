variable "project_id" { type = string }
variable "region" { type = string; default = "europe-west1" }
variable "github_repository" { type = string }
variable "frontend_url" { type = string }
variable "db_password" { type = string; sensitive = true }
variable "jwt_secret" { type = string; sensitive = true }
variable "jwt_refresh_secret" { type = string; sensitive = true }
