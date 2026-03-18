# Najiz Enterprise Go-Live Checklist

## 1. Access and compliance
- Register the company in Najiz Developers.
- Complete sandbox activation and confirm the approved APIs for the enterprise package.
- Confirm data-sharing approval and legal/compliance requirements for client-facing artifacts.

## 2. Environment configuration
- Set `INTEGRATION_ENCRYPTION_KEY`.
- Set `CRON_SECRET`.
- Set `NAJIZ_WEBHOOK_SECRET`.
- Set `NAJIZ_SYNC_BATCH_SIZE`.
- Keep `NAJIZ_USE_MOCK_ADAPTER=1` until sandbox credentials are available.

## 3. Product gating
- Confirm only `ENTERPRISE` organizations can see Najiz pages and APIs.
- Re-test `250 / 500 / 750` plans to verify no Najiz UI or API access is exposed.
- Verify admin-only observability remains hidden from standard users and clients.

## 4. Najiz credentials handoff
- Add `base_url`, `client_id`, `client_secret`, and optional `scope` from the Najiz portal.
- Save credentials through the enterprise Najiz settings page.
- Run health check in sandbox first, then production only after approval.

## 5. Background processing
- Enable the cron job for `/api/cron/najiz-sync`.
- Verify queued `matter_refresh` and `document_prepare` jobs are processed successfully.
- Verify webhook delivery to `/app/api/integrations/najiz/webhooks`.

## 6. Document readiness
- Confirm synced Najiz documents create local `documents` records.
- Confirm `document_prepare` jobs materialize downloadable `document_versions`.
- Confirm non-client-visible Najiz documents do not appear in the client portal.

## 7. Client portal checks
- Verify only `portal_visible` Najiz documents are shown to clients.
- Verify synced session minutes appear as matter timeline activity only when intended.
- Verify client downloads use signed URLs and remain org/client scoped.

## 8. Observability and support
- Review the Najiz admin observability tab for accounts, jobs, logs, and webhooks.
- Confirm failed jobs surface actionable errors.
- Confirm retry behavior is working for transient failures.

## 9. Rollout plan
- Pilot with one internal enterprise org in sandbox.
- Pilot with one real enterprise customer before broad rollout.
- Enable production credentials only after sandbox validation and support playbook completion.

## 10. Post-launch monitoring
- Monitor health checks, webhook failures, and queued jobs daily during the first rollout window.
- Review document preparation failures and storage upload issues.
- Track whether any enterprise-only behavior leaks into standard plans.
