# Terraform — VP Dietetic Center

App infrastructure on Google Cloud, region **europe-west9 (Paris)**, project `vp-dietetic-center`.

```
vp-dietetic-center
├── Artifact Registry  vp-dietetic          (shared, created with the staging state)
├── Cloud SQL          vp-dietetic-db       (shared, db-f1-micro, no internet access)
│   ├── vp_staging
│   └── vp_prod
├── Cloud Run          staging-api, staging-frontend, staging-api-migrate (job)
│                      prod-api,    prod-frontend,    prod-api-migrate    (job)
└── Cloud Storage      <project>-staging-documents, <project>-prod-documents
```

Not managed here (see [`../bootstrap/bootstrap.sh`](../bootstrap/bootstrap.sh)): APIs, service
accounts, the GitHub login link (Workload Identity Federation) and secrets.
Cost guard: [`../budget-cutoff`](../budget-cutoff).

## Who applies what

| Change | Done by |
|---|---|
| Infrastructure (this folder) | **The project owner, from their machine** (`terraform apply`) |
| New app images | GitHub Actions CD (`.github/workflows/cd.yml`) |

The CI/CD deploy account can only push images and update existing Cloud Run services and jobs.
It cannot create databases, buckets or new APIs, change permissions, or read secrets, so a stolen
GitHub token cannot use it to create expensive resources. CI only runs `terraform fmt`/`validate`.

## API access

The API's own `run.app` address is public, but it only answers requests carrying the
`<env>-proxy-token` secret, which the frontend's nginx adds to everything it forwards under
`/api`. Direct calls get a 403 (only `/api/v1/health` is open, for the startup probe and CD).

## Database access

Cloud SQL has no authorized networks and requires client certificates, so the only way in is
Google's Cloud SQL connector, which checks IAM (`roles/cloudsql.client`). Cloud Run mounts it at
`/cloudsql`; `DATABASE_URL` uses `?host=/cloudsql/<connection name>`.
For a local admin session use the [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy).

## Apply

Prerequisites: Terraform >= 1.7, `gcloud auth login` and `gcloud auth application-default login`
as the project owner, bootstrap already run for the environment.

```sh
cd infra/terraform
ENV=staging   # or prod (staging first: it creates the shared registry and database instance)

terraform init -reconfigure -backend-config="prefix=infra/$ENV"

# The DB password comes from Secret Manager, never typed or stored in a file
export TF_VAR_db_password="$(gcloud secrets versions access latest --secret "$ENV-db-password" --project vp-dietetic-center | tr -d '\r\n')"

terraform plan  -var="env=$ENV"
terraform apply -var="env=$ENV"
unset TF_VAR_db_password
```

The first apply creates the Cloud Run services with a public placeholder image; the first CD run
replaces it. Terraform ignores the image afterwards.

The state (in `gs://vp-dietetic-tfstate`) contains the DB password: only the project owner can read it.
