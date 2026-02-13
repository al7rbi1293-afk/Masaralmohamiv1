# مسار المحامي | Masar Al-Muhami

Next.js (App Router) + Supabase.

## Current scope (Phase 1 + 2 + 3 + 4 + 5 + 6 + 7.1.5)

- Marketing pages:
  - `/`
  - `/security`
  - `/privacy`
  - `/terms`
  - `/contact`
  - Landing trial form section: `/#trial`
- Auth routes:
  - `/signin`
  - `/signup`
- Protected platform (`/app`) with trial gating:
  - `/app` (Dashboard)
  - `/app/clients` (CRUD + Archive/Restore)
  - `/app/clients/new`
  - `/app/clients/[id]`
  - `/app/matters` (List + Search + Filters + Pagination)
  - `/app/matters/new`
  - `/app/matters/[id]` (Summary + Timeline + Documents + Edit + Archive/Restore)
  - `/app/documents` (List + Search + Filter + Pagination)
  - `/app/documents/new`
  - `/app/documents/[id]` (Versions + Upload new version + Share + Download)
  - `/app/tasks` (List + Filters + Create/Edit + Done/Cancel)
  - `/app/billing` (Placeholder)
  - `/app/reports` (Placeholder)
  - `/app/audit` (Placeholder)
  - `/app/settings`
  - `/app/expired`
- Trial status debug endpoint:
  - `/app/api/trial-status`
- Trial provisioning endpoint:
  - `POST /api/start-trial`
- Contact/activation request endpoint:
  - `POST /api/contact-request`
- Supabase migration:
  - `supabase/migrations/0001_init.sql`
  - `supabase/migrations/0002_full_version_requests.sql`
  - `supabase/migrations/0003_clients.sql`
  - `supabase/migrations/0004_matters.sql`
  - `supabase/migrations/0005_matter_events.sql`
  - `supabase/migrations/0006_documents.sql`
  - `supabase/migrations/0007_tasks.sql`

## Run locally

```bash
npm install
npm run dev --workspace @masar/web
```

Open: [http://localhost:3000](http://localhost:3000)

## Build

```bash
npm run build --workspace @masar/web
```

## E2E Smoke Tests (Playwright)

```bash
npm run test:e2e:install --workspace @masar/web
npm run test:e2e --workspace @masar/web
```

## Required environment variables

Set in `apps/web/.env.local` (see `.env.example`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Apply Supabase migration

### Option 1: SQL Editor (manual)

1. Open Supabase Dashboard -> SQL Editor.
2. Copy contents of:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_full_version_requests.sql`
   - `supabase/migrations/0003_clients.sql`
   - `supabase/migrations/0004_matters.sql`
   - `supabase/migrations/0005_matter_events.sql`
   - `supabase/migrations/0006_documents.sql`
   - `supabase/migrations/0007_tasks.sql`
3. Run the query.

### Option 2: Supabase CLI

If Supabase CLI is installed and project is linked:

```bash
supabase db push
```

## Test trial status endpoint locally

1. Sign in at:
   - `http://localhost:3000/signin`
2. Open:
   - `http://localhost:3000/app/api/trial-status`
3. Expected:
   - Logged-in user with no org/trial yet -> `status: "none"`

## Start trial flow

1. Open `http://localhost:3000/#trial`.
2. Fill the 14-day trial form.
3. Backend endpoint `POST /api/start-trial` will:
   - Insert a lead in `public.leads`.
   - Sign in existing user or create user then sign in.
   - Provision `organizations` + `memberships` (owner) if missing.
   - Create `trial_subscriptions` for 14 days if not present.
4. User is redirected to `/app` (or `/app/expired` if existing trial is expired).

## Contact request flow (pilot activation)

1. Forms on `/contact` and `/app/expired` submit to `POST /api/contact-request`.
2. Request is saved to `public.full_version_requests`.
3. Endpoint allows anon/authenticated inserts with RLS policy.

## Clients module (Phase 7.1.1)

بعد تطبيق migration `0003_clients.sql`:
- افتح `/app/clients`
- أضف عميل جديد من `/app/clients/new`
- حدّث بيانات العميل من `/app/clients/[id]`
- أرشف العميل أو استعده من القائمة أو صفحة التفاصيل

## Matters module (Phase 7.1.2)

بعد تطبيق migration `0004_matters.sql`:
- افتح `/app/matters` لإنشاء واستعراض القضايا
- أنشئ قضية من `/app/matters/new` واربطها بموكل موجود
- افتح `/app/matters/[id]` لتعديل الملخص والحالة والأرشفة/الاستعادة

### قاعدة الخصوصية للقضايا الخاصة

- القضية العامة: تظهر لكل أعضاء المكتب
- القضية الخاصة: تظهر فقط للشريك (owner) وأعضاء القضية المصرّح لهم
- عند إنشاء قضية خاصة يتم إضافة منشئ القضية تلقائيًا إلى `matter_members`

### اختبار يدوي سريع لخصوصية القضية

1. أنشئ قضية خاصة من حساب عضو داخل المكتب.
2. تأكد أن المنشئ يستطيع فتح القضية في `/app/matters/[id]`.
3. من حساب مستخدم آخر غير مالك وغير عضو في القضية، حاول فتح نفس الرابط:
   - يجب أن تظهر رسالة: `القضية غير موجودة أو لا تملك صلاحية الوصول.`

## Matter timeline (Phase 7.1.3)

بعد تطبيق migration `0005_matter_events.sql`:
- افتح `/app/matters/[id]?tab=timeline`
- أضف حدث جديد (نوع + تاريخ اختياري + ملاحظات)
- صفّ الأحداث حسب النوع وتحقق من الترقيم

### اختبار خصوصية أحداث القضية

1. أنشئ حدثًا داخل قضية عامة:
   - يجب أن يراه أعضاء المكتب.
2. أنشئ حدثًا داخل قضية خاصة:
   - يجب أن يراه الشريك (owner) وأعضاء القضية فقط.
3. من مستخدم من مكتب آخر:
   - لا يمكن قراءة/إضافة أحداث بسبب RLS.

## Documents module (Phase 7.1.4)

بعد تطبيق migration `0006_documents.sql`:
- افتح `/app/documents` لإدارة المستندات
- أنشئ مستندًا وارفع النسخة الأولى من `/app/documents/new`
- افتح `/app/documents/[id]` لرفع نسخة جديدة أو تنزيل آخر نسخة
- أنشئ رابط مشاركة مؤقت (ساعة/24 ساعة/7 أيام)
- افتح رابط المشاركة العام: `/share/[token]`
- داخل القضية: افتح `/app/matters/[id]?tab=documents`

### إنشاء Bucket للمستندات (Supabase Storage)

1. في Supabase Dashboard -> Storage
2. أنشئ Bucket باسم: `documents`
3. اجعله **Private**

> ملاحظة: في الـ MVP، لا نعتمد على Storage RLS. الرفع/التنزيل يتم عبر روابط موقعة (Signed URLs) يتم توليدها من السيرفر.

### تدفق الرفع (مختصر)

1. إنشاء سجل المستند في `public.documents`
2. طلب `signed upload url` من:
   - `POST /app/api/documents/upload-url`
3. رفع الملف إلى Storage باستخدام الرابط/التوكن
4. تثبيت النسخة في `public.document_versions` عبر:
   - `POST /app/api/documents/commit-upload`

### اختبار خصوصية مستندات قضية خاصة

1. أنشئ قضية خاصة وأضف مستندًا لها.
2. من مستخدم غير مالك وغير عضو في القضية:
   - لا يجب أن يرى المستند في `/app/documents` ولا في تبويب مستندات القضية.

## Tasks module (Phase 7.1.5)

بعد تطبيق migration `0007_tasks.sql`:
- افتح `/app/tasks` لإدارة المهام مع الفلاتر
- أنشئ مهمة جديدة (مع ربط اختياري بقضية) ثم عدّلها أو غيّر حالتها إلى "تم" أو "إلغاء"
- داخل القضية: افتح `/app/matters/[id]?tab=tasks` لإدارة مهام القضية

### اختبار خصوصية مهام قضية خاصة

1. أنشئ قضية خاصة وأضف مهمة مرتبطة بها.
2. من مستخدم غير مالك وغير عضو في القضية:
   - لا يجب أن يرى المهمة في `/app/tasks` ولا في تبويب مهام القضية.

## Notes

- `/app` redirects to `/signin` when unauthenticated.
- Expired trials are redirected from `/app/*` to `/app/expired` (except `/app/expired` itself).
- Trial is provisioned per organization and defaults to 14 days.
- Rate limiting:
  - `POST /api/start-trial`: `5` requests / `10` minutes / IP.
  - `POST /api/contact-request`: `10` requests / `10` minutes / IP.
- `getTrialStatusForCurrentUser` is implemented in:
  - `apps/web/lib/trial.ts`
- Deployment guide: `DEPLOYMENT.md`
- QA checklist: `QA_CHECKLIST.md`
- Observability: `OBSERVABILITY.md`
- Security baseline: `SECURITY.md`
- Pilot runbook: `PILOT_PLAYBOOK.md`
- Rate limiting note: `apps/web/lib/rateLimit.md`
