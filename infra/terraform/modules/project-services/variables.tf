variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "services" {
  description = "List of GCP APIs to enable"
  type        = list(string)
  default = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "vpcaccess.googleapis.com",
  ]
}
