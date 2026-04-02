variable "project_id" { type = string }
variable "bucket_name" { type = string }
variable "location" { type = string }
variable "force_destroy" { type = bool; default = false }
variable "versioning_enabled" { type = bool; default = true }
variable "retention_days" { type = number; default = 1825 } # 5 ans
variable "cors_origins" { type = list(string); default = [] }
variable "labels" { type = map(string); default = {} }
