resource "google_sql_database_instance" "main" {
  project          = var.project_id
  name             = "${var.name_prefix}-postgres"
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    tier              = var.tier
    availability_type = var.availability_type
    disk_size         = var.disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = var.availability_type == "REGIONAL"
      backup_retention_settings {
        retained_backups = var.backup_retention_count
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network
      require_ssl     = true
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
    }
  }

  deletion_protection = var.deletion_protection
}

resource "google_sql_database" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = var.database_name
}

resource "google_sql_user" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = var.database_user
  password = var.database_password
}
