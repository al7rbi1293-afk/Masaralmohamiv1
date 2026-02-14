# Najiz Integration (تشغيليًا) — Masar Al-Muhami

هذا المستند يشرح إعداد تكامل **ناجز** وتشغيله بشكل آمن داخل مسار المحامي، مع نقاط استكشاف الأعطال.

مهم:
- التكامل يعتمد على **واجهات رسمية** وبيانات OAuth. لا يوجد scraping.
- لا تشارك بيانات `Client Secret`.
- كل شيء مقيد على مستوى المكتب (Organization) عبر RLS.

## المتطلبات

1. صلاحيات Owner في المكتب داخل مسار.
2. بيانات OAuth من ناجز (حسب الاعتماد الرسمي):
   - `Base URL`
   - `Client ID`
   - `Client Secret`
   - `Scope` (اختياري)
3. ضبط متغير البيئة (على Vercel والبيئة المحلية):
   - `INTEGRATION_ENCRYPTION_KEY` (مفتاح تشفير طويل وعشوائي)

## إعداد التكامل

1. افتح: `/app/settings/integrations/najiz`
2. أدخل:
   - البيئة (Sandbox أو Production)
   - Base URL
   - Client ID / Client Secret
3. اضغط: **حفظ + اختبار الاتصال**

ملاحظة: بعد ربط التكامل لأول مرة، يمكنك تحديث Base URL/البيئة بدون إعادة إدخال Client ID/Secret (اتركها فارغة).

## المزامنة (Sync Now)

1. في نفس الصفحة أدخل **مسار الـ endpoint** حسب وثائق ناجز الرسمية، مثال:
   - `/api/v1/cases`
2. اضغط: **مزامنة الآن**
3. لمشاهدة النتائج: `/app/external/najiz`

المزامنة تحفظ فقط **بيانات مرجعية**، وإنشاء القضايا داخل مسار يتم يدويًا عبر زر:
**"إنشاء قضية في مسار"**.

## Sandbox vs Production

- ابدأ بـ Sandbox إذا توفر عندك، للتأكد من صحة Base URL وبيانات OAuth.
- Production غالبًا يختلف في Base URL و/أو Scope حسب ما توفره الجهة.
- في حال فشل الحصول على Access Token:
  - تأكد من Base URL (خصوصًا endpoint الخاص بـ OAuth).
  - تأكد من Client ID/Secret.
  - راجع Scope (إن كان مطلوبًا).

## الأمان والسجلات

- لا يتم تسجيل (Logging) ردود ناجز أو محتوى القضايا في سجلات السيرفر.
- يتم تسجيل **بيانات تشغيلية فقط** (مثال: عدد العناصر المستوردة، مدة التنفيذ، الحالة).

## استكشاف الأخطاء

### 1) "Could not find the table 'public.org_integrations' in the schema cache"
هذا يعني أن مجرايشن التكامل لم تُطبق أو PostgREST لم يحدث الـ schema cache.
- طبّق:
  - `supabase/migrations/0020_integrations.sql`
- ثم نفّذ:
  - `select pg_notify('pgrst', 'reload schema');`

### 2) "لم يتم إعداد التكامل بعد."
لم يتم إدخال بيانات OAuth. ادخلها ثم احفظ.

### 3) "بيانات Najiz غير صحيحة أو لا تملك صلاحية الوصول."
Client ID/Secret غير صحيح أو الحساب غير مصرح. حدث البيانات ثم جرّب.

### 4) "انتهت مهلة الاتصال بـ Najiz."
قد يكون endpoint بطيئًا أو الشبكة. جرّب مرة أخرى أو قلل الضغط على ناجز.

### 5) "فشل طلب المزامنة (4xx/5xx)"
تحقق من:
- مسار الـ endpoint
- هل يحتاج Query Params؟
- هل يحتاج صلاحيات/Scope مختلفة؟

