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

# ─── Database ─────────────────────────────────────────────────

variable "db_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "db_password_staging" {
  type      = string
  sensitive = true
}

variable "db_password_prod" {
  type      = string
  sensitive = true
}
