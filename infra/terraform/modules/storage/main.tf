resource "google_storage_bucket" "bucket" {
  project       = var.project_id
  name          = var.bucket_name
  location      = var.location
  force_destroy = var.force_destroy

  uniform_bucket_level_access = true

  versioning {
    enabled = var.versioning_enabled
  }

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = var.retention_days }
  }

  cors {
    origin          = var.cors_origins
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["Content-Type", "Content-Length", "Authorization"]
    max_age_seconds = 3600
  }

  labels = var.labels
}
