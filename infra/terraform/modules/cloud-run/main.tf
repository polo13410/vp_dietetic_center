resource "google_cloud_run_v2_service" "main" {
  project  = var.project_id
  name     = var.name
  location = var.region

  template {
    service_account = var.service_account_email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_env_vars
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      liveness_probe {
        http_get {
          path = var.health_check_path
        }
        initial_delay_seconds = 30
        period_seconds        = 30
      }
    }

    vpc_access {
      connector = var.vpc_connector
      egress    = "PRIVATE_RANGES_ONLY"
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  labels = var.labels
}

# Rendre le service public (si nécessaire)
resource "google_cloud_run_v2_service_iam_member" "public" {
  count    = var.allow_public_access ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.main.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
