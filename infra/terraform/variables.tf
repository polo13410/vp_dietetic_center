variable "env" {
  description = "Environment: staging or prod"
  type        = string

  validation {
    condition     = contains(["staging", "prod"], var.env)
    error_message = "env must be staging or prod."
  }
}

variable "project_id" {
  type    = string
  default = "vp-dietetic-center"
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "github_repository" {
  type    = string
  default = "polo13410/vp_dietetic_center"
}

variable "db_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "db_password" {
  type      = string
  sensitive = true
}
