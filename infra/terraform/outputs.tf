# ─── Database (staging only) ──────────────────────────────────

output "db_instance_name" {
  value = local.is_staging ? google_sql_database_instance.main[0].name : null
}

output "db_connection_name" {
  value = local.is_staging ? google_sql_database_instance.main[0].connection_name : null
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

# ─── Custom domain ───────────────────────────────────────────────────────────

output "app_url" {
  value = local.app_url
}

output "firebase_hosting_url" {
  value = "https://${google_firebase_hosting_site.app.site_id}.web.app"
}

# Records to create at the domain's registrar for the custom domain to work
output "dns_records" {
  value = flatten([
    for update in google_firebase_hosting_custom_domain.app.required_dns_updates : [
      for desired in update.desired : [
        for record in desired.records : {
          name  = desired.domain_name
          type  = record.type
          value = record.rdata
        } if record.required_action == "ADD"
      ]
    ]
  ])
}
