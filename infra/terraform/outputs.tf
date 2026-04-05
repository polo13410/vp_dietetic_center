# ─── Database (staging only) ──────────────────────────────────

output "db_instance_name" {
  value = local.is_staging ? google_sql_database_instance.main[0].name : null
}

output "db_connection_name" {
  value = local.is_staging ? google_sql_database_instance.main[0].connection_name : null
}

output "db_public_ip" {
  value = local.is_staging ? google_sql_database_instance.main[0].public_ip_address : null
}

# ─── Cloud Run URLs ──────────────────────────────────────────

output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "frontend_url" {
  value = google_cloud_run_v2_service.frontend.uri
}

# ─── Artifact Registry ───────────────────────────────────────

output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/vp-dietetic"
}

# ─── Auth ─────────────────────────────────────────────────────

output "wif_provider" {
  value = "projects/820685118866/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
}
