output "api_url" { value = module.api.url }
output "frontend_url" { value = module.frontend.url }
output "artifact_registry" { value = module.artifact_registry.repository_url }
output "workload_identity_provider" { value = module.service_accounts.workload_identity_provider }
output "github_service_account" { value = module.service_accounts.github_service_account_email }
