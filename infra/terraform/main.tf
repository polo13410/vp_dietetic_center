# ─── Project Services ─────────────────────────────────────────────────────────

module "project_services" {
  source     = "./modules/project-services"
  project_id = var.project_id
}

# ─── Artifact Registry (shared) ──────────────────────────────────────────────

resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = "vp-dietetic"
  format        = "DOCKER"
  description   = "Docker images for VP Dietetic Center"

  depends_on = [module.project_services]
}

# ─── Cloud SQL (shared instance, 2 databases) ────────────────────────────────

resource "google_sql_database_instance" "main" {
  project          = var.project_id
  name             = "vp-dietetic-db"
  database_version = "POSTGRES_15"
  region           = var.region

  deletion_protection = false

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled = true
      authorized_networks {
        name  = "allow-all"
        value = "0.0.0.0/0"
      }
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      backup_retention_settings {
        retained_backups = 7
      }
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    insights_config {
      query_insights_enabled = true
    }
  }

  depends_on = [module.project_services]
}

# Staging database
resource "google_sql_database" "staging" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = "vp_staging"
}

resource "google_sql_user" "staging" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = "vp_staging"
  password = var.db_password_staging
}

# Production database
resource "google_sql_database" "prod" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = "vp_prod"
}

resource "google_sql_user" "prod" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = "vp_prod"
  password = var.db_password_prod
}

# ─── Storage Buckets (per env) ────────────────────────────────────────────────

resource "google_storage_bucket" "staging_documents" {
  project                     = var.project_id
  name                        = "${var.project_id}-staging-documents"
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  cors {
    origin          = ["*"]
    method          = ["GET", "PUT", "POST", "DELETE"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }

  depends_on = [module.project_services]
}

resource "google_storage_bucket" "prod_documents" {
  project                     = var.project_id
  name                        = "${var.project_id}-prod-documents"
  location                    = var.region
  force_destroy               = false
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 1825 # 5 years
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "PUT", "POST", "DELETE"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }

  depends_on = [module.project_services]
}

# ─── Cloud Run — Staging ──────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "staging_api" {
  project  = var.project_id
  name     = "staging-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = "vp-staging-api@${var.project_id}.iam.gserviceaccount.com"

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/vp-dietetic/api:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/api/v1/health"
        }
        initial_delay_seconds = 10
        timeout_seconds       = 5
        period_seconds        = 15
        failure_threshold     = 10
      }

      env {
        name  = "NODE_ENV"
        value = "staging"
      }
      env {
        name  = "CORS_ORIGINS"
        value = "*"
      }
      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.staging_documents.name
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = "staging-db-url"
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = "staging-jwt-secret"
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_REFRESH_SECRET"
        value_source {
          secret_key_ref {
            secret  = "staging-jwt-refresh-secret"
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [google_sql_database.staging, module.project_services]

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_service_iam_member" "staging_api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.staging_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service" "staging_frontend" {
  project  = var.project_id
  name     = "staging-frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = "vp-staging-frontend@${var.project_id}.iam.gserviceaccount.com"

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/vp-dietetic/frontend:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      ports {
        container_port = 80
      }

      startup_probe {
        http_get {
          path = "/"
          port = 80
        }
        initial_delay_seconds = 3
        period_seconds        = 5
      }
    }
  }

  depends_on = [module.project_services]

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_service_iam_member" "staging_frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.staging_frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ─── Cloud Run — Production ───────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "prod_api" {
  project  = var.project_id
  name     = "prod-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = "vp-prod-api@${var.project_id}.iam.gserviceaccount.com"

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/vp-dietetic/api:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/api/v1/health"
        }
        initial_delay_seconds = 10
        timeout_seconds       = 5
        period_seconds        = 15
        failure_threshold     = 10
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "CORS_ORIGINS"
        value = "*"
      }
      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.prod_documents.name
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = "prod-db-url"
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = "prod-jwt-secret"
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_REFRESH_SECRET"
        value_source {
          secret_key_ref {
            secret  = "prod-jwt-refresh-secret"
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [google_sql_database.prod, module.project_services]

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_service_iam_member" "prod_api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.prod_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service" "prod_frontend" {
  project  = var.project_id
  name     = "prod-frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = "vp-prod-frontend@${var.project_id}.iam.gserviceaccount.com"

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/vp-dietetic/frontend:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      ports {
        container_port = 80
      }

      startup_probe {
        http_get {
          path = "/"
          port = 80
        }
        initial_delay_seconds = 3
        period_seconds        = 5
      }
    }
  }

  depends_on = [module.project_services]

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_service_iam_member" "prod_frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.prod_frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
