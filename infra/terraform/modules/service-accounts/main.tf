resource "google_service_account" "api" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-api"
  display_name = "VP Dietetic — API Service Account"
}

resource "google_service_account" "frontend" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-frontend"
  display_name = "VP Dietetic — Frontend Service Account"
}

resource "google_service_account" "github_actions" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-github"
  display_name = "VP Dietetic — GitHub Actions Service Account"
}

# Workload Identity Pool pour GitHub Actions
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "${var.name_prefix}-github-pool"
  display_name              = "GitHub Actions Pool"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_condition = "assertion.repository == '${var.github_repository}'"
}

resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}
