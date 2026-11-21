#!/usr/bin/env bash
# One-time setup of vp-dietetic-center that Terraform does not manage.
# Run as the project owner (gcloud auth login). Safe to re-run: existing resources are kept.
#
# - APIs used by the app
# - service accounts: one deploy account for GitHub Actions, one runtime account per service
# - Workload Identity Federation: GitHub Actions can act as the deploy account, but only for
#   this repository, from the staging/prod branches, in a job bound to a GitHub environment
# - least-privilege roles (the deploy account can only deploy new images to existing services)
# - secrets, stored in the app region only, readable only by the matching API runtime account
#
# Usage: ENVS="staging" ./bootstrap.sh      (default: staging prod)
set -euo pipefail

PROJECT=vp-dietetic-center
REGION=europe-west9
REPO_ID=958839439        # polo13410/vp_dietetic_center
OWNER_ID=11178802        # polo13410
POOL=github-pool
PROVIDER=github-provider
ENVS=${ENVS:-"staging prod"}

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
DEPLOY_SA="vp-github-deploy@$PROJECT.iam.gserviceaccount.com"

say() { printf '\n== %s\n' "$*"; }

create_sa() { # name, display name
  gcloud iam service-accounts describe "$1@$PROJECT.iam.gserviceaccount.com" --project "$PROJECT" >/dev/null 2>&1 ||
    gcloud iam service-accounts create "$1" --display-name "$2" --project "$PROJECT"
}

bind_project() { # member, role
  gcloud projects add-iam-policy-binding "$PROJECT" --member "$1" --role "$2" --condition=None --quiet >/dev/null
  echo "  $2 -> $1"
}

say "APIs"
gcloud services enable --project "$PROJECT" \
  run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  storage.googleapis.com logging.googleapis.com monitoring.googleapis.com \
  cloudresourcemanager.googleapis.com firebase.googleapis.com firebasehosting.googleapis.com

say "Service accounts"
create_sa vp-github-deploy "GitHub Actions deploy (images only)"
for env in $ENVS; do
  create_sa "vp-$env-api" "API runtime ($env)"
  create_sa "vp-$env-frontend" "Frontend runtime ($env)"
done

say "Workload Identity Federation"
gcloud iam workload-identity-pools describe "$POOL" --location global --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create "$POOL" --location global --project "$PROJECT" \
    --display-name "GitHub Actions"
CONDITION="assertion.repository_id == '$REPO_ID' && assertion.repository_owner_id == '$OWNER_ID' \
&& assertion.ref in ['refs/heads/staging', 'refs/heads/prod'] \
&& assertion.environment in ['staging', 'production']"
MAPPING="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,\
attribute.ref=assertion.ref,attribute.environment=assertion.environment"
if gcloud iam workload-identity-pools providers describe "$PROVIDER" --workload-identity-pool "$POOL" \
    --location global --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" --workload-identity-pool "$POOL" \
    --location global --project "$PROJECT" --attribute-mapping "$MAPPING" --attribute-condition "$CONDITION"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --workload-identity-pool "$POOL" \
    --location global --project "$PROJECT" --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "$MAPPING" --attribute-condition "$CONDITION"
fi
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --project "$PROJECT" --quiet >/dev/null \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository_id/$REPO_ID"
echo "  GitHub repo $REPO_ID may act as $DEPLOY_SA"

say "Deploy account roles (deploy images to existing services/jobs, nothing else)"
bind_project "serviceAccount:$DEPLOY_SA" roles/run.developer
bind_project "serviceAccount:$DEPLOY_SA" roles/artifactregistry.writer
for env in $ENVS; do
  for app in api frontend; do
    gcloud iam service-accounts add-iam-policy-binding "vp-$env-$app@$PROJECT.iam.gserviceaccount.com" \
      --project "$PROJECT" --member "serviceAccount:$DEPLOY_SA" --role roles/iam.serviceAccountUser --quiet >/dev/null
    echo "  deploy account may run revisions as vp-$env-$app"
  done
done

say "Runtime roles"
for env in $ENVS; do
  bind_project "serviceAccount:vp-$env-api@$PROJECT.iam.gserviceaccount.com" roles/cloudsql.client
done

say "Secrets ($REGION only)"
ensure_secret() { # name, readers...
  local name=$1; shift
  gcloud secrets describe "$name" --project "$PROJECT" >/dev/null 2>&1 ||
    gcloud secrets create "$name" --project "$PROJECT" --replication-policy user-managed --locations "$REGION"
  for reader in "$@"; do
    gcloud secrets add-iam-policy-binding "$name" --project "$PROJECT" --quiet >/dev/null \
      --member "serviceAccount:$reader" --role roles/secretmanager.secretAccessor
  done
}
has_version() { [ -n "$(gcloud secrets versions list "$1" --project "$PROJECT" --filter='state=ENABLED' --format='value(name)' --limit 1)" ]; }
# hex: safe inside a connection URL. Strip CR too: openssl on Windows ends lines with CRLF.
random() { openssl rand -hex 32 | tr -d '\r\n'; }
read_secret() { gcloud secrets versions access latest --secret "$1" --project "$PROJECT" | tr -d '\r\n'; }

API_READERS=()
for env in $ENVS; do API_READERS+=("vp-$env-api@$PROJECT.iam.gserviceaccount.com"); done
ensure_secret google-oauth-client-id "${API_READERS[@]}"
# Brevo SMTP credentials, shared by the environments. Values are added by the owner (see
# infra/terraform/README.md), then smtp_enabled=true in Terraform.
ensure_secret smtp-user "${API_READERS[@]}"
ensure_secret smtp-password "${API_READERS[@]}"

for env in $ENVS; do
  api="vp-$env-api@$PROJECT.iam.gserviceaccount.com"
  frontend="vp-$env-frontend@$PROJECT.iam.gserviceaccount.com"
  # The DB password is read by the person running Terraform (owner), not by the app
  ensure_secret "$env-db-password"
  ensure_secret "$env-db-url" "$api"
  ensure_secret "$env-jwt-secret" "$api"
  # Shared by the frontend's nginx and the API: the API refuses requests without it
  ensure_secret "$env-proxy-token" "$api" "$frontend"

  # Values are piped straight into Secret Manager and never printed
  has_version "$env-jwt-secret" || random | gcloud secrets versions add "$env-jwt-secret" --data-file=- --project "$PROJECT" >/dev/null
  has_version "$env-proxy-token" || random | gcloud secrets versions add "$env-proxy-token" --data-file=- --project "$PROJECT" >/dev/null
  if ! has_version "$env-db-password"; then
    random | gcloud secrets versions add "$env-db-password" --data-file=- --project "$PROJECT" >/dev/null
  fi
  if ! has_version "$env-db-url"; then
    # Cloud Run reaches Cloud SQL through its built-in connector (unix socket), never over the internet
    printf 'postgresql://vp_%s:%s@localhost/vp_%s?host=/cloudsql/%s:%s:vp-dietetic-db' \
      "$env" "$(read_secret "$env-db-password")" \
      "$env" "$PROJECT" "$REGION" |
      gcloud secrets versions add "$env-db-url" --data-file=- --project "$PROJECT" >/dev/null
  fi
  echo "  $env secrets ready"
done

has_version google-oauth-client-id ||
  echo "  ! google-oauth-client-id has no value yet: add the OAuth client ID (public value) with
    printf '%s' '<client-id>' | gcloud secrets versions add google-oauth-client-id --data-file=- --project $PROJECT"

say "Done"
echo "GCP_WIF_PROVIDER    = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"
echo "GCP_SERVICE_ACCOUNT = $DEPLOY_SA"
