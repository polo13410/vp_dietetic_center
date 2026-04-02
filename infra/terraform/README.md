# Terraform — VP Dietetic Center

Infrastructure Google Cloud Platform gérée avec Terraform.

## Architecture déployée

```
├── Artifact Registry (images Docker)
├── Cloud Run API (NestJS)
├── Cloud Run Frontend (Nginx + React)
├── Cloud SQL (PostgreSQL 15)
├── Cloud Storage (documents patients)
├── Secret Manager (secrets applicatifs)
├── Service Accounts (principe moindre privilège)
├── IAM (permissions)
└── Monitoring / Alerting
```

## Prérequis

- Terraform >= 1.7
- gcloud CLI configuré
- Bucket GCS pour le state Terraform créé manuellement

## Structure

```
infra/terraform/
├── modules/
│   ├── project-services/     # APIs GCP activées
│   ├── artifact-registry/    # Registry images Docker
│   ├── cloud-run/            # Service Cloud Run générique
│   ├── cloud-sql/            # Instance PostgreSQL
│   ├── storage/              # Buckets GCS
│   ├── secret-manager/       # Secrets
│   ├── service-accounts/     # Comptes de service
│   ├── iam/                  # Permissions IAM
│   └── monitoring/           # Alertes de base
└── envs/
    ├── dev/                  # Environnement dev
    ├── staging/              # Environnement staging
    └── prod/                 # Environnement production
```

## Premier déploiement

```bash
# 1. Créer le bucket pour le state (une seule fois)
gcloud storage buckets create gs://vp-dietetic-tfstate \
  --location=europe-west1 \
  --uniform-bucket-level-access

# 2. Initialiser Terraform
cd infra/terraform/envs/dev
terraform init

# 3. Planifier
terraform plan -var-file="dev.tfvars"

# 4. Appliquer
terraform apply -var-file="dev.tfvars"
```

## Variables requises

Copier `*.tfvars.example` en `*.tfvars` et remplir les valeurs.

**Ne jamais committer les fichiers `.tfvars` !**

## Déploiement via CI/CD

Les workflows GitHub Actions gèrent automatiquement :

- `terraform plan` sur chaque PR (commentaire automatique)
- `terraform apply` sur merge vers `develop` (env dev/staging)
- `terraform apply` sur merge vers `main` avec approbation manuelle (prod)
