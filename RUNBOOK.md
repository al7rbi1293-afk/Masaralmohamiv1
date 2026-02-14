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

