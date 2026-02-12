# QA Checklist (Phase 6)

## Prerequisites
- Set env vars in `apps/web/.env.local`.
- Apply SQL migrations:
  - `supabase/migrations/0001_init.sql`
  - `supabase/migrations/0002_full_version_requests.sql`
- Run app: `npm run dev --workspace @masar/web`

## Manual Smoke Tests
1. Open `http://localhost:3000`.
   - Confirm landing renders in Arabic RTL.
   - Confirm main heading shows: `مسار المحامي`.
2. Click CTA `جرّب مجانًا 14 يوم`.
   - Confirm smooth scroll to section `#trial`.
3. Submit trial form with a new email.
   - Confirm redirect to `/app`.
   - Confirm dashboard card shows trial status + remaining days.
4. Submit trial form with existing email + wrong password.
   - Confirm redirect to `/signin?reason=exists`.
   - Confirm message appears: `هذا البريد مسجل بالفعل. سجّل الدخول لإكمال التجربة.`
5. Click `تسجيل الخروج`.
   - Confirm visiting `/app` redirects to `/signin`.
6. Force expired trial:
   - In Supabase SQL Editor run:
     ```sql
     update public.trial_subscriptions
     set ends_at = now() - interval '1 day', status = 'expired'
     where org_id = '<ORG_ID>';
     ```
   - Confirm visiting `/app` redirects to `/app/expired`.
7. On `/app/expired`, submit activation request form.
   - Confirm success message: `تم استلام طلبك. سنتواصل معك قريبًا.`
8. Open `/contact`, submit form.
   - Confirm success message and keep mailto button available.
9. Open `/security`, `/privacy`, `/terms`, `/contact`.
   - Confirm all mailto links target `masar.almohami@outlook.sa`.

## Rate Limiting Verification
1. Start-trial limit:
   - Send more than 5 requests within 10 minutes to `POST /api/start-trial` from same IP.
   - Expect `429` with Arabic rate-limit message.
2. Contact-request limit:
   - Send more than 10 requests within 10 minutes to `POST /api/contact-request`.
   - Expect `429` with Arabic rate-limit message.

## Automated E2E (Playwright)
1. Install browsers once:
   - `npm run test:e2e:install --workspace @masar/web`
2. Run tests:
   - `npm run test:e2e --workspace @masar/web`
