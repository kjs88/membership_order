# Membership order background runner

GitHub Pages stores jobs in Firebase Realtime Database. A Cloud Run Job polls `order-ops/jobs`, claims `QUEUED` work transactionally, checks the Eroum session in a headless browser, and writes a detailed report back to the same job. The dashboard is the review and acceptance surface.

## Current scope

- Claims queued work and reports `RUNNING`, then `HOLD` or `AWAITING_REVIEW`.
- Writes worker identity, start/end timestamps, row counts, reason details, and a dashboard review state.
- Never submits an order. `report.canSubmit` is always `false`.
- Validates that a server-side Eroum browser session is present and active.
- Product mapping, cart creation, delivery address entry, and final submission adapters are not wired yet. Unconfigured rows are reported as `HOLD` for the dashboard.

## GitHub Actions worker

The repository workflow `.github/workflows/order-worker.yml` runs every five minutes and can also be started manually. It checks Firebase for dashboard jobs in `QUEUED` status and returns a report to the same job. The user's PC and browser are not involved.

Configure these GitHub Actions secrets before enabling the worker:

- `FIREBASE_DATABASE_URL`: the project's Realtime Database URL.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: a Firebase service account JSON with Realtime Database access.
- `EROUM_STORAGE_STATE_JSON`: Playwright storage state for the authorized Eroum account. Never commit it or put it in the dashboard.

`FIREBASE_QUEUE_PATH` defaults to `order-ops/jobs`; `WORKER_ID` is optional. Suggested state flow: `QUEUED → RUNNING → AWAITING_REVIEW → SUBMIT_QUEUED → COMPLETED`. Failures and unresolved fields remain `HOLD` or `FAILED`. The dashboard records review and any future final approval. A future submit adapter must verify explicit dashboard approval before it can submit.

## Build

Use Node.js 22 locally. The scheduled GitHub Actions runner uses the Playwright container image so Chromium is available. The Firebase service account JSON is read from the process environment and is never written into the repository.

```sh
npm install
npm run build
```
