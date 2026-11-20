# App infrastructure for one environment (staging or prod), applied by the project owner.
# Accounts, the GitHub login link (Workload Identity) and secrets come from ../bootstrap.
# CI/CD only deploys new images to the services created here.

locals {
  is_staging = var.env == "staging"
  is_prod    = var.env == "prod"

  db_instance_name   = "vp-dietetic-db"
  db_connection_name = "${var.project_id}:${var.region}:${local.db_instance_name}"
  registry           = "${var.region}-docker.pkg.dev/${var.project_id}/vp-dietetic"

  api_sa      = "vp-${var.env}-api@${var.project_id}.iam.gserviceaccount.com"
  frontend_sa = "vp-${var.env}-frontend@${var.project_id}.iam.gserviceaccount.com"

  # Public "hello" image so the services can be created before the first real image exists.
  # CD replaces it; Terraform then ignores the image (see lifecycle blocks).
  placeholder_image = "us-docker.pkg.dev/cloudrun/container/hello"

  cfg = {
    staging = {
      # Staging runs exactly like prod: secure cookies, no Swagger, JSON logs
      node_env               = "production"
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

# ─── Shared resources (created with the staging state) ───────────────────────

resource "google_artifact_registry_repository" "docker" {
  count         = local.is_staging ? 1 : 0
  project       = var.project_id
  location      = var.region
  repository_id = "vp-dietetic"
  format        = "DOCKER"
  description   = "Docker images for VP Dietetic Center"
}

# One small instance hosts both databases (vp_staging, vp_prod) to fit the budget.
resource "google_sql_database_instance" "main" {
  count            = local.is_staging ? 1 : 0
  project          = var.project_id
  name             = local.db_instance_name
  database_version = "POSTGRES_15"
  region           = var.region

  deletion_protection = true

  settings {
    edition                     = "ENTERPRISE" # shared-core tiers are not available in Enterprise Plus
    tier                        = var.db_tier
    availability_type           = "ZONAL"
    disk_size                   = 10
    disk_type                   = "PD_SSD"
    disk_autoresize             = true
    deletion_protection_enabled = true

    ip_configuration {
      # No authorized networks: the only way in is Google's Cloud SQL connector, which checks IAM
      # (roles/cloudsql.client) and client certificates. Direct password logins are refused.
      ipv4_enabled = true
      ssl_mode     = "TRUSTED_CLIENT_CERTIFICATE_REQUIRED"
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = false
      backup_retention_settings {
        retained_backups = 7
      }
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

  depends_on = [google_sql_database_instance.main]
}

resource "google_sql_user" "user" {
  project  = var.project_id
  instance = local.db_instance_name
  name     = "vp_${var.env}"
  password = var.db_password

  depends_on = [google_sql_database_instance.main]
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
}

resource "google_storage_bucket_iam_member" "api_documents" {
  bucket = google_storage_bucket.documents.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${local.api_sa}"
}

# ─── Cloud Run — API ─────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  name     = "${var.env}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = local.api_sa

    scaling {
      min_instance_count = 0
      max_instance_count = local.cfg.max_api_instances
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [local.db_connection_name]
      }
    }

    containers {
      image = local.placeholder_image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
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
        # Only this environment's frontend may call the API with credentials
        name  = "CORS_ORIGINS"
        value = google_cloud_run_v2_service.frontend.uri
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
      env {
        name = "GOOGLE_CLIENT_ID"
        value_source {
          secret_key_ref {
            secret  = "google-oauth-client-id"
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [google_sql_database.db, google_sql_user.user]

  lifecycle {
    ignore_changes = [template[0].containers[0].image, client, client_version]
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
      service_account = local.api_sa
      max_retries     = 0
      timeout         = "300s"

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [local.db_connection_name]
        }
      }

      containers {
        image   = local.placeholder_image
        command = ["npx"]
        args    = ["prisma", "migrate", "deploy"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
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

  depends_on = [google_sql_database.db, google_sql_user.user]

  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image, client, client_version]
  }
}

# ─── Cloud Run — Frontend ────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "frontend" {
  project  = var.project_id
  name     = "${var.env}-frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = local.frontend_sa

    scaling {
      min_instance_count = 0
      max_instance_count = local.cfg.max_frontend_instances
    }

    containers {
      image = local.placeholder_image

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
    ignore_changes = [template[0].containers[0].image, client, client_version]
  }
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
