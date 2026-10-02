# Membership order background runner

GitHub Pages stores jobs in Firebase Realtime Database. A Cloud Run Job polls `order-ops/jobs`, claims `QUEUED` work transactionally, checks the Eroum session in a headless browser, and writes a detailed report back to the same job. The dashboard is the review and acceptance surface.

## Current scope

- Claims queued work and reports `RUNNING`, then `HOLD` or `AWAITING_REVIEW`.
- Writes worker identity, start/end timestamps, row counts, reason details, and a dashboard review state.
- Never submits an order. `report.canSubmit` is always `false`.
- Validates that a server-side Eroum browser session is present and active.
- Product mapping, cart creation, delivery address entry, and final submission adapters are not wired yet. Unconfigured rows are reported as `HOLD` for the dashboard.

## Cloud deployment

Deploy this directory as a Cloud Run Job and invoke it from Cloud Scheduler once per minute. Give the Cloud Run service account Firebase Realtime Database access using Application Default Credentials. Store `EROUM_STORAGE_STATE_JSON` in Secret Manager and inject it as an environment variable. Never put login state or passwords in GitHub source or the dashboard.

Required environment variables:

- `FIREBASE_DATABASE_URL`
- `FIREBASE_QUEUE_PATH` (defaults to `order-ops/jobs`)
- `WORKER_ID` (optional)
- `EROUM_STORAGE_STATE_JSON` (Secret Manager injection)

Suggested state flow: `QUEUED → RUNNING → AWAITING_REVIEW → SUBMIT_QUEUED → COMPLETED`. Failures and unresolved fields remain `HOLD` or `FAILED`. The dashboard records the review decision and separate final submission approval; any future submit adapter must verify that approval.

## Build

Use Node.js 22 or Docker. Cloud Run uses Application Default Credentials; no service account key file is baked into the image.

```sh
npm install
npm run build
```
