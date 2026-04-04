# ─── Database ─────────────────────────────────────────────────

output "db_instance_name" {
  value = google_sql_database_instance.main.name
}

output "db_connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "db_public_ip" {
  value = google_sql_database_instance.main.public_ip_address
}

# ─── Staging URLs ─────────────────────────────────────────────

output "staging_api_url" {
  value = google_cloud_run_v2_service.staging_api.uri
}

output "staging_frontend_url" {
  value = google_cloud_run_v2_service.staging_frontend.uri
}

# ─── Production URLs ─────────────────────────────────────────

output "prod_api_url" {
  value = google_cloud_run_v2_service.prod_api.uri
}

output "prod_frontend_url" {
  value = google_cloud_run_v2_service.prod_frontend.uri
}

# ─── Artifact Registry ───────────────────────────────────────

output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/vp-dietetic"
}

# ─── Auth ─────────────────────────────────────────────────────

output "wif_provider" {
  value = "projects/820685118866/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
}
