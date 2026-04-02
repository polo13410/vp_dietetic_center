resource "google_secret_manager_secret" "secrets" {
  for_each  = var.secrets
  project   = var.project_id
  secret_id = each.key

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_version" "versions" {
  for_each    = { for k, v in var.secrets : k => v if v != null }
  secret      = google_secret_manager_secret.secrets[each.key].id
  secret_data = each.value
}
