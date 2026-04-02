variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }
variable "image" { type = string }
variable "service_account_email" { type = string }
variable "min_instances" { type = number; default = 0 }
variable "max_instances" { type = number; default = 10 }
variable "cpu" { type = string; default = "1" }
variable "memory" { type = string; default = "512Mi" }
variable "health_check_path" { type = string; default = "/api/health" }
variable "allow_public_access" { type = bool; default = true }
variable "vpc_connector" { type = string; default = "" }
variable "env_vars" { type = map(string); default = {} }
variable "secret_env_vars" {
  type = map(object({ secret = string; version = string }))
  default = {}
}
variable "labels" { type = map(string); default = {} }
