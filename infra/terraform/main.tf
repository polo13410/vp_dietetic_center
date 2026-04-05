# ─── Locals ───────────────────────────────────────────────────────────────────

locals {
  is_staging = var.env == "staging"
  is_prod    = var.env == "prod"

  db_instance_name = "vp-dietetic-db"

  cfg = {
    staging = {
      node_env               = "staging"
      max_api_instances      = 1
      max_frontend_instances = 1
      bucket_force_destroy   = true
    }
    prod = {
      node_env               = "production"
      max_api_instances      = 1
      max_frontend_instances = 1
      bucket_force_destroy   = false
    }
  }[var.env]
}

# ─── Shared resources (staging only) ─────────────────────────────────────────

module "project_services" {
  count      = local.is_staging ? 1 : 0
  source     = "./modules/project-services"
  project_id = var.project_id
}

resource "google_artifact_registry_repository" "docker" {
  count         = local.is_staging ? 1 : 0
  project       = var.project_id
  location      = var.region
  repository_id = "vp-dietetic"
  format        = "DOCKER"
  description   = "Docker images for VP Dietetic Center"

  depends_on = [module.project_services]
}

resource "google_sql_database_instance" "main" {
  count            = local.is_staging ? 1 : 0
  project          = var.project_id
  name             = local.db_instance_name
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
      enabled    = true
      start_time = "03:00"
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
}

# ─── Per-env database & user ─────────────────────────────────────────────────

resource "google_sql_database" "db" {
  project  = var.project_id
  instance = local.db_instance_name
  name     = "vp_${var.env}"
}

resource "google_sql_user" "user" {
  project  = var.project_id
  instance = local.db_instance_name
  name     = "vp_${var.env}"
  password = var.db_password
}

# ─── Storage Bucket ──────────────────────────────────────────────────────────

resource "google_storage_bucket" "documents" {
  project                     = var.project_id
  name                        = "${var.project_id}-${var.env}-documents"
  location                    = var.region
  force_destroy               = local.cfg.bucket_force_destroy
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  dynamic "versioning" {
    for_each = local.is_prod ? [1] : []
    content {
      enabled = true
    }
  }

  dynamic "lifecycle_rule" {
    for_each = local.is_prod ? [1] : []
    content {
      condition {
        age = 1825 # 5 years
      }
      action {
        type = "Delete"
      }
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "PUT", "POST", "DELETE"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

# ─── Cloud Run — API ─────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  name     = "${var.env}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = "vp-${var.env}-api@${var.project_id}.iam.gserviceaccount.com"

    scaling {
      min_instance_count = 0
      max_instance_count = local.cfg.max_api_instances
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
        value = local.cfg.node_env
      }
      env {
        name  = "CORS_ORIGINS"
        value = "*"
      }
      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.documents.name
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = "${var.env}-db-url"
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = "${var.env}-jwt-secret"
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_REFRESH_SECRET"
        value_source {
          secret_key_ref {
            secret  = "${var.env}-jwt-refresh-secret"
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [google_sql_database.db]

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ─── Cloud Run — Migration Job ───────────────────────────────────────────────

resource "google_cloud_run_v2_job" "api_migrate" {
  project  = var.project_id
  name     = "${var.env}-api-migrate"
  location = var.region

  template {
    task_count = 1

    template {
      service_account = "vp-${var.env}-api@${var.project_id}.iam.gserviceaccount.com"
      max_retries     = 0
      timeout         = "300s"

      containers {
        image   = "${var.region}-docker.pkg.dev/${var.project_id}/vp-dietetic/api:latest"
        command = ["npx"]
        args    = ["prisma", "migrate", "deploy"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = "${var.env}-db-url"
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [google_sql_database.db]

  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image]
  }
}

# ─── Cloud Run — Frontend ────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "frontend" {
  project  = var.project_id
  name     = "${var.env}-frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = "vp-${var.env}-frontend@${var.project_id}.iam.gserviceaccount.com"

    scaling {
      min_instance_count = 0
      max_instance_count = local.cfg.max_frontend_instances
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

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
