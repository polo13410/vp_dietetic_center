# Terraform — VP Dietetic Center

Infrastructure Google Cloud Platform geree avec Terraform.

## Architecture

Single GCP project (`vp-dietetic-center`) hosting both staging and production:

```
vp-dietetic-center (GCP Project)
├── Artifact Registry (shared, Docker images)
├── Cloud SQL PostgreSQL 15 (shared instance)
│   ├── vp_staging (database)
│   └── vp_prod (database)
├── Cloud Run
│   ├── staging-api (NestJS)
│   ├── staging-frontend (Nginx)
│   ├── prod-api (NestJS)
│   └── prod-frontend (Nginx)
├── Cloud Storage
│   ├── staging-documents (bucket)
│   └── prod-documents (bucket)
├── Secret Manager (JWT secrets, DB passwords only)
└── Service Accounts (per-service, least privilege)
```

## Cost Optimization

- **Shared PostgreSQL** — single db-f1-micro instance with 2 databases
- **Shared Artifact Registry** — one repo for all images
- **Min instances = 0** — no idle costs (cold starts ~2-3s)
- **Minimal secrets** — only real secrets in Secret Manager (4 total)
- **No VPC connector** — saves ~$7/month

## Prerequisites

- Terraform >= 1.7
- gcloud CLI configured (`gcloud config configurations activate dietetic-center`)
- State bucket: `gs://vp-dietetic-tfstate` (already created)

## Usage

```bash
cd infra/terraform

# Init
terraform init

# Plan
terraform plan \
  -var="db_password_staging=xxx" \
  -var="db_password_prod=xxx"

# Apply
terraform apply \
  -var="db_password_staging=xxx" \
  -var="db_password_prod=xxx"
```

## CI/CD

- `terraform plan` runs on PRs to staging/prod/main
- `terraform apply` runs on push to staging/prod branches
- Production requires manual approval in GitHub

## Branches & Environments

| Branch | GitHub Env | Cloud Run Services | Database |
|--------|-----------|-------------------|----------|
| staging | staging | staging-api, staging-frontend | vp_staging |
| prod | production | prod-api, prod-frontend | vp_prod |

## Secrets (GitHub Actions)

**Repository secrets (shared):**
- `GCP_PROJECT_ID`
- `GCP_SERVICE_ACCOUNT`
- `GCP_WIF_PROVIDER`

**Environment secrets (per-env):**
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `DB_PASSWORD`
