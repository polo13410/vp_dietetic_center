"""Budget cutoff: switches billing off on the app project once the monthly budget is spent.

Triggered by the Cloud Billing budget's Pub/Sub notifications. Runs in a separate "guard"
project that the app's deploy account cannot reach, so a compromised deploy cannot remove it.
"""

import base64
import json
import os

import functions_framework
import google.auth
from google.auth.transport.requests import AuthorizedSession

TARGET_PROJECT_ID = os.environ["TARGET_PROJECT_ID"]
# Anything other than an explicit "false" keeps the function harmless.
DRY_RUN = os.environ.get("DRY_RUN", "true").lower() != "false"

BILLING_INFO_URL = f"https://cloudbilling.googleapis.com/v1/projects/{TARGET_PROJECT_ID}/billingInfo"


def log(severity: str, message: str, **fields) -> None:
    """Structured log line that Cloud Logging parses."""
    print(json.dumps({"severity": severity, "message": message, **fields}), flush=True)


@functions_framework.cloud_event
def stop_billing(cloud_event) -> None:
    payload = json.loads(base64.b64decode(cloud_event.data["message"]["data"]).decode("utf-8"))
    cost = float(payload.get("costAmount", 0))
    budget = float(payload.get("budgetAmount", 0))
    currency = payload.get("currencyCode", "")
    context = {
        "budget": payload.get("budgetDisplayName"),
        "cost": cost,
        "budget_amount": budget,
        "currency": currency,
        "dry_run": DRY_RUN,
    }

    if budget <= 0 or cost < budget:
        log("INFO", "Under budget, nothing to do", **context)
        return

    if DRY_RUN:
        log("WARNING", f"DRY RUN: would disable billing on {TARGET_PROJECT_ID}", **context)
        return

    # Unlinking is idempotent, so no need to read the current state first
    # (that would need an extra read permission on the app project).
    credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-billing"])
    session = AuthorizedSession(credentials)
    response = session.put(BILLING_INFO_URL, json={"billingAccountName": ""}, timeout=30)
    response.raise_for_status()
    log("CRITICAL", f"Budget exceeded: billing disabled on {TARGET_PROJECT_ID}", **context)
