# RUNBOOK (Phase 9.5.0)

هذا الملف هو “دليل تشغيل” مختصر لإطلاق النسخة وإدارة الأعطال للمشروع على Vercel + Supabase.

الدعم:
- `masar.almohami@outlook.sa`

## 1) Checklist قبل النشر

### أ) قواعد البيانات (Supabase)

- تأكد أن جميع ملفات المِجريشن تحت:
  - `supabase/migrations/`
  قد تم تطبيقها على مشروع Supabase (بالترتيب).
- إذا تستخدم Supabase CLI:
  - `supabase db push`
- أو عبر SQL Editor:
  - انسخ محتوى ملفات المِجريشن والصقه بالتتابع.

ملاحظات:
- أي جداول جديدة أو سياسات RLS غير مطبقة ستسبب أخطاء 400/403 داخل المنصة.

### ب) التخزين (Supabase Storage)

- تأكد من وجود bucket باسم:
  - `documents`
- يجب أن يكون **Private**.

### ج) متغيرات البيئة (Vercel Environment Variables)

إلزامي:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Server-only)
- `NEXT_PUBLIC_SITE_URL` (ضع رابط الدومين النهائي)

مستحسن:
- `APP_VERSION` (مثال: `1.0.0` أو `pilot-2026-02-14`)

اختياري:
- `NEXT_PUBLIC_SENTRY_DSN` (Client + Server)
- `SENTRY_DSN` (Server-only)
- `ADMIN_ACTIVATION_SECRET` (إن كنت تستخدم تفعيل الاشتراك يدويًا)
- مفاتيح Stripe (إن كان Stripe مُفعلًا في مشروعك)

### د) تحقق سريع قبل الإعلان

- افتح:
  - `/api/health`
  وتأكد من الاستجابة: `{ ok: true }`
- جرّب “بدء تجربة” من الصفحة الرئيسية ثم الوصول لـ`/app`.
- جرّب رفع مستند وتنزيله وتصدير PDF لفاتورة (إذا كانت الجداول مطبقة).

## 2) خطوات النشر (Vercel)

### طريقة 1: عبر GitHub

- Push إلى `main`
- Vercel يبني ويعمل Deploy تلقائيًا

### طريقة 2: عبر Vercel CLI

- `vercel --prod`

## 3) Rollback Plan (عند وجود مشكلة)

### أ) Rollback سريع (Vercel)

1. افتح مشروع Vercel
2. Deployments
3. اختر آخر نسخة سليمة
4. استخدم “Instant Rollback” أو “Promote to Production”

### ب) تحذير مهم عن DB migrations

- الـRollback في Vercel لا يرجع قواعد البيانات لحالة سابقة.
- إذا تم تطبيق مِجريشن فيه تغيير غير متوافق:
  - راجع `/OPS_BACKUP_DR.md` لإجراءات الاستعادة
  - قد تحتاج Restore لنسخة احتياطية من Supabase

## 4) Incident Checklist (أول 15 دقيقة)

### أ) تأكد من الحالة العامة

1. `/api/health` يعمل؟
2. راجع Vercel Logs للـProduction deployment:
   - أخطاء 5xx
   - رسائل timeouts / circuit breaker (قد تظهر 503)
3. إذا Sentry مُفعل:
   - راجع Issues (بدون إرسال بيانات حساسة)

### ب) مشاكل تسجيل الدخول / الصلاحيات

- إذا تظهر 401/403 بشكل واسع:
  - تأكد من متغيرات Supabase (`URL/ANON/SERVICE_ROLE`)
  - تأكد أن RLS policies مطبقة كما هي
  - جرّب Owner:
    - `/app/settings/diagnostics` للحصول على Org ID + آخر تدقيق

### ج) مشاكل المستندات

- إذا فشل الرفع/التنزيل:
  - تأكد bucket `documents` موجود وPrivate
  - راقب endpoints:
    - `/app/api/documents/upload-url`
    - `/app/api/documents/download-url`
  - إذا رجع 503:
    - قد يكون فشل مؤقت أو circuit breaker (حاول بعد 30 ثانية)

### د) مشاكل PDF

- إذا فشل `تصدير PDF`:
  - راقب endpoint:
    - `/app/api/invoices/<id>/pdf`
  - إذا رجع 503:
    - قد يكون Timeout/ضغط مؤقت (أعد المحاولة)

### هـ) مشاكل Rate limiting

- إذا رجعت 429:
  - راجع سياسات rate limits في المشروع (قد تكون مفرطة على بيئة تجريبية)

## 5) ما الذي نطلبه من العميل عند الدعم؟

- راجع `SUPPORT.md`

## 6) Legal Copilot Operations

### أ) نشر الـCopilot (Web + Worker)

1. طبّق مِجريشنز الـCopilot:
   - `20260303120000_copilot_init.sql`
   - `20260303121000_copilot_rls.sql`
   - `20260303122000_copilot_rpc.sql`
2. أضف متغيرات البيئة في Vercel:
   - `SUPABASE_JWT_SECRET`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL_EMBEDDING`
   - `OPENAI_MODEL_MID`
   - `OPENAI_MODEL_STRONG`
   - `COPILOT_REQUESTS_MONTHLY_DEFAULT`
   - `COPILOT_TOKENS_MONTHLY_DEFAULT`
   - `COPILOT_RATE_LIMIT_PER_MINUTE`
   - `COPILOT_CACHE_TTL_RETRIEVAL_SEC`
   - `COPILOT_CACHE_TTL_ANSWER_SEC`
3. انشر Web على Vercel.
4. انشر Worker من `apps/worker` على Fly.io أو Railway مع نفس متغيرات Supabase/OpenAI.
5. راقب لوق worker وتأكد انتقال مستندات `case_documents` من `queued` إلى `ready`.

### ب) Rotation Procedure (Keys)

1. أنشئ مفتاح جديد لدى OpenAI.
2. حدّث `OPENAI_API_KEY` في بيئة الإنتاج.
3. أعد تشغيل worker.
4. اختبر `/api/copilot` على قضية تجريبية.
5. ألغ المفتاح القديم بعد التحقق.

لـ`SUPABASE_JWT_SECRET`:
1. تدوير المفتاح يتطلب تنسيقًا مع Supabase Auth JWT config.
2. طبّق المفتاح الجديد في Supabase أولًا.
3. حدّث `SUPABASE_JWT_SECRET` في Web/Worker.
4. راقب أخطاء 401/403 خلال أول 15 دقيقة.

### ج) Monitoring Queries (SQL)

#### 1) فشل المعالجة في الـWorker

```sql
select
  cd.org_id,
  cd.case_id,
  cd.id as case_document_id,
  cd.last_error_code,
  cd.last_error_message,
  cd.updated_at
from public.case_documents cd
where cd.status = 'failed'
order by cd.updated_at desc
limit 100;
```

#### 2) بطء الاسترجاع/الإجابة

```sql
select
  date_trunc('hour', created_at) as hour_bucket,
  percentile_cont(0.50) within group (order by latency_ms) as p50_ms,
  percentile_cont(0.95) within group (order by latency_ms) as p95_ms,
  count(*) as total
from public.copilot_audit_logs
where status in ('ok', 'validation_failed')
group by 1
order by 1 desc
limit 48;
```

#### 3) أعلى استهلاك Tokens

```sql
select
  org_id,
  user_id,
  model,
  sum(input_tokens + output_tokens) as total_tokens,
  count(*) as requests
from public.copilot_audit_logs
where created_at >= now() - interval '30 days'
group by org_id, user_id, model
order by total_tokens desc
limit 100;
```

#### 4) رصد طفرات Quota

```sql
select
  month_start,
  org_id,
  user_id,
  requests_used,
  tokens_used
from public.copilot_usage
where month_start = date_trunc('month', now())::date
order by tokens_used desc
limit 100;
```

### د) Incident Playbooks

#### OCR Failures

1. تحقق من توفر `tesseract` و `pdftoppm` في worker host.
2. افحص `case_documents.last_error_code`.
3. أعد Queue للمستندات المؤثرة:
   - `status='queued'`, `next_retry_at=now()`, وتصفير `last_error_*` عند الحاجة.

#### Vector Index Bloat / Slow Similarity

1. راقب زمن RPC `match_case_chunks` و`match_kb_chunks`.
2. نفّذ `REINDEX INDEX CONCURRENTLY` على:
   - `idx_document_chunks_embedding`
   - `idx_kb_chunks_embedding`
3. شغّل `VACUUM (ANALYZE)` للجداول:
   - `document_chunks`
   - `kb_chunks`

#### Quota Spikes / Abuse

1. راجع `copilot_usage` + `copilot_audit_logs` لنفس `org_id/user_id`.
2. اخفض `COPILOT_RATE_LIMIT_PER_MINUTE` مؤقتًا.
3. اخفض `COPILOT_REQUESTS_MONTHLY_DEFAULT` للحسابات عالية المخاطر.
4. إذا استمرت الطفرة، عطل مؤقتًا الوصول للـcopilot للمستخدم المتسبب.

#### Model Outage / Provider Errors

1. راجع أخطاء OpenAI في logs.
2. فعّل fallback الرسائل الآمنة (الـAPI يرسل رد fail-closed).
3. زِد retries للـworker مؤقتًا.
4. بعد استعادة الخدمة، أعد Queue للمستندات `failed` المتأثرة.
