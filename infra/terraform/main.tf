# App infrastructure for one environment (staging or prod), applied by the project owner.
# Accounts, the GitHub login link (Workload Identity) and secrets come from ../bootstrap.
# CI/CD only deploys new images to the services created here.

data "google_project" "this" {
  project_id = var.project_id
}

locals {
  is_staging = var.env == "staging"
  is_prod    = var.env == "prod"

  db_instance_name   = "vp-dietetic-db"
  db_connection_name = "${var.project_id}:${var.region}:${local.db_instance_name}"
  registry           = "${var.region}-docker.pkg.dev/${var.project_id}/vp-dietetic"

  api_sa      = "vp-${var.env}-api@${var.project_id}.iam.gserviceaccount.com"
  frontend_sa = "vp-${var.env}-frontend@${var.project_id}.iam.gserviceaccount.com"

  # The app's public address: its own domain (through Firebase Hosting)
  app_url = "https://${local.cfg.domain}"

  # Cloud Run's predictable address for the API service. The frontend forwards /api there;
  # using it (instead of the service's uri) avoids a frontend <-> API dependency loop.
  api_url = "https://${var.env}-api-${data.google_project.this.number}.${var.region}.run.app"

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
      domain                 = "staging.app.dietetiquecenter.fr"
    }
    prod = {
      node_env               = "production"
      max_api_instances      = 1
      max_frontend_instances = 1
      bucket_force_destroy   = false
      domain                 = "app.dietetiquecenter.fr"
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
      require_ssl  = true # legacy flag: provider v5 sends false by default, which conflicts with ssl_mode
    }

    # Light PITR: restore to any second of the last 3 days (WAL kept 3 days, a few cents a month
    # for this database size). A restore clones the whole instance (staging and prod databases)
    # into a new instance; it never rewinds this one in place.
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 3
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
        # Through the domain, requests reach the API via Firebase Hosting, Google's front end and
        # nginx: the visitor's address is the third from the end of X-Forwarded-For
        name  = "TRUST_PROXY_HOPS"
        value = "3"
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
        # Requests without it did not come through the frontend and are refused
        name = "PROXY_TOKEN"
        value_source {
          secret_key_ref {
            secret  = "${var.env}-proxy-token"
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
        # Billed per request: nginx has nothing to do between requests (the API keeps its CPU,
        # it finishes work such as audit entries after answering)
        cpu_idle = true
      }

      ports {
        container_port = 80
      }

      env {
        # nginx forwards /api/* to the API, so the browser only talks to the frontend's origin
        name  = "API_URL"
        value = local.api_url
      }
      env {
        # Added by nginx to every API call: the API accepts nothing else
        name = "PROXY_TOKEN"
        value_source {
          secret_key_ref {
            secret  = "${var.env}-proxy-token"
            version = "latest"
          }
        }
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

# ─── Custom domain ───────────────────────────────────────────────────────────
# Cloud Run cannot map a domain in europe-west9, and a load balancer would cost more than the
# rest of the project. Firebase Hosting serves the domain (free certificate, edge cache for the
# app's static files) and forwards every request to the frontend service.

resource "google_firebase_project" "default" {
  provider = google-beta
  count    = local.is_staging ? 1 : 0 # once per project, with the staging state
  project  = var.project_id
}

resource "google_firebase_hosting_site" "app" {
  provider = google-beta
  project  = var.project_id
  site_id  = "vp-dietetic-${var.env}"

  depends_on = [google_firebase_project.default]
}

resource "google_firebase_hosting_version" "app" {
  provider = google-beta
  site_id  = google_firebase_hosting_site.app.site_id

  config {
    rewrites {
      glob = "**"
      run {
        service_id = google_cloud_run_v2_service.frontend.name
        region     = var.region
      }
    }
  }
}

resource "google_firebase_hosting_release" "app" {
  provider     = google-beta
  site_id      = google_firebase_hosting_site.app.site_id
  version_name = google_firebase_hosting_version.app.name
  message      = "Forward every request to ${google_cloud_run_v2_service.frontend.name}"
}

resource "google_firebase_hosting_custom_domain" "app" {
  provider      = google-beta
  project       = var.project_id
  site_id       = google_firebase_hosting_site.app.site_id
  custom_domain = local.cfg.domain

  # The DNS records are added by hand at the registrar (see the dns_records output)
  wait_dns_verification = false
}
