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
  default = "europe-west9" # Paris
}

variable "smtp_enabled" {
  description = "Send emails through Brevo. Needs the smtp-user and smtp-password secrets to have a value."
  type        = bool
  default     = false
}

variable "smtp_from" {
  description = "Sender of the app's emails (an address or domain verified in Brevo)"
  type        = string
  default     = "VP Diététique <noreply@dietetiquecenter.fr>"
}

variable "db_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "db_password" {
  description = "Read from Secret Manager (<env>-db-password) by the person applying, never typed"
  type        = string
  sensitive   = true
}
