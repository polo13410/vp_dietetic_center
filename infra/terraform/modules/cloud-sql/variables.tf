variable "project_id" { type = string }
variable "region" { type = string }
variable "name_prefix" { type = string }
variable "tier" { type = string; default = "db-f1-micro" }
variable "availability_type" { type = string; default = "ZONAL" }
variable "disk_size_gb" { type = number; default = 10 }
variable "backup_retention_count" { type = number; default = 7 }
variable "vpc_network" { type = string }
variable "database_name" { type = string }
variable "database_user" { type = string }
variable "database_password" { type = string; sensitive = true }
variable "deletion_protection" { type = bool; default = true }
