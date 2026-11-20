# Budget cutoff

Switches billing **off** on `vp-dietetic-center` as soon as the monthly budget is spent, so a
runaway or malicious workload (crypto-mining, scaled-up services…) cannot keep costing money.

```
Cloud Billing budget "vp-dietetic-center monthly cap" (16 CHF ≈ 20 USD / month)
   │  publishes cost updates several times a day
   ▼
Pub/Sub topic  projects/vp-dietetic-guard/topics/budget-alerts
   ▼
Cloud Run function  budget-cutoff  (vp-dietetic-guard, europe-west1)
   │  cost >= budget  →  PUT billingInfo { billingAccountName: "" }
   ▼
vp-dietetic-center: billing unlinked, every paid service stops
```

## Why a separate project

The function, its topic and its service account live in **`vp-dietetic-guard`**. The app's deploy
account has no access there, so a compromised CI/CD pipeline cannot delete or disable the cutoff.
`budget-cutoff@vp-dietetic-guard` only holds `roles/billing.projectManager` on `vp-dietetic-center`
(link/unlink billing, nothing else).

## Limits

- Google reports costs with a delay of a few hours (sometimes up to a day): spending can go a bit past
  the budget before the cutoff runs. The Cloud Run CPU quota (6 vCPU in `europe-west1`, 1 elsewhere)
  bounds how fast that can happen.
- Purchases and commitments are not stopped by unlinking billing. The capped virtual card on the
  billing account is the protection for those.
- If billing stays unlinked for weeks, Google deletes resources such as Cloud SQL instances.

## When it fires

1. Find and fix the cause (Cloud Run, Cloud SQL, audit logs) **before** relinking.
2. Relink billing:
   ```sh
   gcloud billing projects link vp-dietetic-center --billing-account=010202-A28472-0C0B53
   ```
3. If the month's spend is already over the budget, the next notification will unlink it again:
   raise the budget for the month first (or wait for the next month).

## Deploy / update

Run from this folder as the project owner.

```sh
gcloud functions deploy budget-cutoff --gen2 --project vp-dietetic-guard --region europe-west1 \
  --runtime python312 --source . --entry-point stop_billing --trigger-topic budget-alerts \
  --service-account budget-cutoff@vp-dietetic-guard.iam.gserviceaccount.com \
  --trigger-service-account budget-cutoff@vp-dietetic-guard.iam.gserviceaccount.com \
  --build-service-account projects/vp-dietetic-guard/serviceAccounts/fn-builder@vp-dietetic-guard.iam.gserviceaccount.com \
  --set-env-vars TARGET_PROJECT_ID=vp-dietetic-center,DRY_RUN=false \
  --max-instances 1 --memory 256Mi --no-allow-unauthenticated
```

`DRY_RUN=true` (the default when unset) only logs `DRY RUN: would disable billing`.

## Testing

Publishing a fake over-budget notification **really unlinks billing** when `DRY_RUN=false`:

```sh
gcloud pubsub topics publish budget-alerts --project vp-dietetic-guard \
  --message='{"budgetDisplayName":"TEST","costAmount":17.5,"budgetAmount":16,"currencyCode":"CHF"}'
```

Afterwards, clear any queued retries before relinking billing:

```sh
gcloud pubsub subscriptions seek <eventarc-subscription> --project vp-dietetic-guard --time=<now, UTC>
```

Tested end to end on 2026-11-20: billing went from enabled to disabled within seconds.
