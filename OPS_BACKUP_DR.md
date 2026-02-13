# Backups & Disaster Recovery Playbook (Phase 9.2.0)

هذا المستند يوضح خطة النسخ الاحتياطي والاستعادة لمشروع **مسار المحامي** (Next.js + Supabase + Supabase Storage) بهدف جاهزية تشغيلية لمرحلة تجريبية/إنتاج.

> ملاحظة: لا يوجد “استرجاع تلقائي” داخل التطبيق. هذا Playbook تشغيلي لمشرف النظام.

## 1) ما الذي يجب نسخه احتياطيًا؟

### أ) قاعدة البيانات (Supabase Postgres)
- جميع جداول `public` (المنصة، الفوترة، التدقيق، الدعوات…).
- مخطط القاعدة (Schema) + سياسات RLS + الدوال/التريجرات.
- تاريخ المِجريشن:
  - مجلد `supabase/migrations/` داخل الريبو (Git).

### ب) التخزين (Supabase Storage)
- Bucket: `documents` (Private)
- مسارات الملفات حسب النمط:
  - `org/<org_id>/doc/<document_id>/v<version_no>/<filename>`

### ج) إعدادات البيئة (Environment Variables)
احتفظ بنسخة آمنة (Password manager / Secrets manager) من:
- Vercel env vars (Production + Preview):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SITE_URL`
  - `ADMIN_ACTIVATION_SECRET`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_ID_*`
- إعدادات Supabase:
  - Project URL / Region
  - إعدادات Auth (Redirect URLs, Email confirmations, Providers)

> لا تحفظ الأسرار داخل Git. استخدم `.env.local` محليًا فقط وهو ضمن `.gitignore`.

## 2) كيف نأخذ النسخ الاحتياطي؟

### أ) قاعدة البيانات (DB)
**الخيار 1 (الموصى به إن كان متاحًا):** Supabase Backups/PITR  
استخدم Supabase Dashboard:
- Database -> Backups (أو Point-in-time restore حسب الخطة)
- خذ Snapshot دوري/يومي حسب الخطة

**الخيار 2 (يدوي):** `pg_dump`
1. احصل على Connection String من Supabase Dashboard:
   - Settings -> Database -> Connection string
2. نفّذ `pg_dump` إلى ملف (مشفّر خارجياً إن أمكن):
   ```bash
   pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > backup.dump
   ```
ملاحظات:
- يفضّل استخدام الاتصال المباشر (port 5432) بدل pooler إن أمكن عند أخذ النسخ.
- خزّن النسخة في مكان آمن (S3/GCS) مع تشفير + صلاحيات وصول محدودة.

### ب) التخزين (Supabase Storage)
Bucket المستندات `documents` خاص (Private). لاستعادة/نسخ الملفات يجب الحفاظ على **نفس** `storage_path` المخزن في جدول `document_versions`.

**نسخ يدوي (pilot صغير):**
- من Supabase Dashboard -> Storage -> Bucket `documents` يمكنك تنزيل الملفات.

**نسخ عبر سكربت (مقترح):**
- استخدم `supabase-js` + `SUPABASE_SERVICE_ROLE_KEY` لتنزيل جميع الملفات من Bucket `documents` محليًا ثم ارفعها إلى مكان النسخ الاحتياطي.
- لا يوجد سكربت رسمي داخل الريبو حاليًا لتجنب الأتمتة الثقيلة؛ يمكن إضافته لاحقًا حسب الحاجة.

### ج) سجل المِجريشن (Schema History)
- المصدر الأساسي: Git + مجلد `supabase/migrations/`.
- الموصى به: إنشاء Tag لكل إصدار إنتاجي (Release tag) مع رقم إصدار.

### د) وتيرة النسخ (Cadence مقترح)
- DB: يوميًا (على الأقل).
- Storage: أسبوعيًا (أو يوميًا إن كانت الملفات حساسة وكثيرة).
- اختبار استعادة (Restore drill): شهريًا (على الأقل في مرحلة pilot).

## 3) الاستعادة (Restore) — قائمة تحقق

### أ) استعادة قاعدة البيانات
**سيناريو 1:** استعادة كاملة من Supabase Backup/PITR  
اتبع خطوات Supabase لاستعادة النسخة المطلوبة إلى مشروع جديد أو نفس المشروع (بحسب السياسة).

**سيناريو 2:** استعادة من `pg_dump`
1. جهّز Postgres الهدف (مثلاً Supabase مشروع جديد).
2. نفّذ `pg_restore`:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" backup.dump
   ```

### ب) استعادة التخزين
1. أنشئ Bucket باسم `documents` واجعله Private.
2. ارفع الملفات إلى **نفس المسارات** التي كانت عليها:
   - `org/<org_id>/doc/<document_id>/v<version_no>/<filename>`
3. تحقق أن `document_versions.storage_path` يشير لمسار موجود فعلياً.

### ج) إعادة نشر التطبيق
1. اضبط Environment Variables في Vercel للمشروع.
2. تأكد من `NEXT_PUBLIC_SITE_URL` مطابق للدومين الإنتاجي.
3. انشر (Deploy) آخر نسخة.

## 4) تحقق ما بعد الاستعادة (Verification)
نفّذ تحقق سريع:
- فتح `/` (الصفحة تعمل و RTL صحيح).
- إنشاء حساب/تسجيل دخول ثم فتح `/app`.
- التأكد من RLS:
  - لا يمكن لمستخدم من مكتب A قراءة بيانات مكتب B.
  - القضايا الخاصة لا تظهر إلا للمالك/الأعضاء المصرّح لهم.
- التحقق من التخزين:
  - تنزيل مستند عبر Signed URL يعمل.
- تحقق الفوترة:
  - فتح فاتورة وتصدير PDF يعمل.

**استعلامات تحقق (اختياري):**
- عدد المكاتب: `select count(*) from organizations;`
- عدد العضويات: `select count(*) from memberships;`

## 5) RTO / RPO (أهداف واقعية)
- **RPO (فقدان بيانات مقبول):** يعتمد على تردد النسخ. في مرحلة pilot: استهدف 24 ساعة (نسخ يومي).
- **RTO (وقت استعادة الخدمة):** يعتمد على توفر الفريق والصلاحيات. في مرحلة pilot: من عدة ساعات إلى يوم عمل.

> لا تُقدّم أرقامًا “مضمونة” دون أتمتة ونسخ PITR فعلي.

## 6) أداة مساعدة داخل المنصة (اختياري)
يوجد Endpoint (للمالك فقط) لتصدير ملخص Metadata (ليس تصدير بيانات كامل):
- `GET /app/api/admin/export-metadata`
يرجع JSON يحتوي على:
- معلومات المكتب الأساسية
- عدادات (عملاء/قضايا/مستندات/مهام/فواتير…)
- حالة التجربة/الاشتراك
- نطاقات تاريخية (أول/آخر إنشاء)
