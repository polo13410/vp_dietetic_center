terraform {
  required_version = ">= 1.7"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "vp-dietetic-tfstate"
    prefix = "dev"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  env        = "dev"
  name_prefix = "vp-dietetic-${local.env}"
  labels = {
    environment = local.env
    project     = "vp-dietetic"
    managed_by  = "terraform"
  }
}

# ── APIs ──────────────────────────────────────────────────────────────────────

module "project_services" {
  source     = "../../modules/project-services"
  project_id = var.project_id
}

# ── Artifact Registry ─────────────────────────────────────────────────────────

module "artifact_registry" {
  source        = "../../modules/artifact-registry"
  project_id    = var.project_id
  region        = var.region
  repository_id = "vp-dietetic"
  labels        = local.labels

  depends_on = [module.project_services]
}

# ── Service Accounts ──────────────────────────────────────────────────────────

module "service_accounts" {
  source            = "../../modules/service-accounts"
  project_id        = var.project_id
  name_prefix       = local.name_prefix
  github_repository = var.github_repository

  depends_on = [module.project_services]
}

# ── Storage ───────────────────────────────────────────────────────────────────

module "documents_bucket" {
  source        = "../../modules/storage"
  project_id    = var.project_id
  bucket_name   = "${local.name_prefix}-documents"
  location      = var.region
  force_destroy = true # Autorisé en dev
  cors_origins  = [var.frontend_url]
  labels        = local.labels
}

# ── Cloud SQL ─────────────────────────────────────────────────────────────────

module "cloud_sql" {
  source              = "../../modules/cloud-sql"
  project_id          = var.project_id
  region              = var.region
  name_prefix         = local.name_prefix
  tier                = "db-f1-micro"
  availability_type   = "ZONAL"
  disk_size_gb        = 10
  vpc_network         = "projects/${var.project_id}/global/networks/default"
  database_name       = "vp_dietetic"
  database_user       = "vp_user"
  database_password   = var.db_password
  deletion_protection = false # Autorisé en dev
  labels              = local.labels

  depends_on = [module.project_services]
}

# ── Secrets ───────────────────────────────────────────────────────────────────

module "secrets" {
  source     = "../../modules/secret-manager"
  project_id = var.project_id
  secrets = {
    "vp-dev-jwt-secret"         = var.jwt_secret
    "vp-dev-jwt-refresh-secret" = var.jwt_refresh_secret
    "vp-dev-database-url"       = "postgresql://vp_user:${var.db_password}@${module.cloud_sql.private_ip}/vp_dietetic"
  }
  labels     = local.labels

  depends_on = [module.project_services]
}

# ── Cloud Run — API ───────────────────────────────────────────────────────────

module "api" {
  source                = "../../modules/cloud-run"
  project_id            = var.project_id
  region                = var.region
  name                  = "${local.name_prefix}-api"
  image                 = "${module.artifact_registry.repository_url}/api:latest"
  service_account_email = module.service_accounts.api_service_account_email
  min_instances         = 0
  max_instances         = 3
  memory                = "512Mi"
  health_check_path     = "/api/health"
  labels                = local.labels

  env_vars = {
    NODE_ENV              = local.env
    PORT                  = "3000"
    CORS_ORIGINS          = var.frontend_url
    GCS_BUCKET_NAME       = module.documents_bucket.bucket_name
    GOOGLE_CLOUD_PROJECT  = var.project_id
  }

  secret_env_vars = {
    DATABASE_URL        = { secret = "vp-dev-database-url", version = "latest" }
    JWT_SECRET          = { secret = "vp-dev-jwt-secret", version = "latest" }
    JWT_REFRESH_SECRET  = { secret = "vp-dev-jwt-refresh-secret", version = "latest" }
  }

  depends_on = [module.cloud_sql, module.secrets]
}

# ── Cloud Run — Frontend ──────────────────────────────────────────────────────

module "frontend" {
  source                = "../../modules/cloud-run"
  project_id            = var.project_id
  region                = var.region
  name                  = "${local.name_prefix}-frontend"
  image                 = "${module.artifact_registry.repository_url}/frontend:latest"
  service_account_email = module.service_accounts.frontend_service_account_email
  min_instances         = 0
  max_instances         = 3
  memory                = "256Mi"
  health_check_path     = "/"
  labels                = local.labels

  env_vars = {
    VITE_API_URL = "${module.api.url}/api/v1"
  }

  depends_on = [module.api]
}
