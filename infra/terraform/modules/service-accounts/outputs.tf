output "api_service_account_email" { value = google_service_account.api.email }
output "frontend_service_account_email" { value = google_service_account.frontend.email }
output "github_service_account_email" { value = google_service_account.github_actions.email }
output "workload_identity_provider" { value = google_iam_workload_identity_pool_provider.github.name }
