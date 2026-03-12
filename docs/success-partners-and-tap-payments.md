# Success Partners + Tap Payments

## 1) نظرة عامة
تم تنفيذ نظام مترابط داخل المشروع الحالي لـ **MasarAlMohami.com** يتكوّن من:
- برنامج الإحالة بالعمولة **"شركاء النجاح"**.
- تكامل **Tap Payments** للدفع وربط الاشتراك بالعمولة.

المنطق الأساسي:
- تسجيل شريك عبر صفحة عامة `/success-partners`.
- اعتماد/رفض إداري عبر `/admin` تبويب **شركاء النجاح**.
- توليد كود إحالة احترافي + رابط فريد.
- تتبّع زيارات الإحالة عبر `?ref=CODE` مع Cookie + LocalStorage.
- ربط الإحالة بعمليات `signup` و`start-trial`.
- إنشاء عمولة فقط بعد **دفع ناجح فعلي** من Tap (Webhook).

## 2) البنية المضافة

### الواجهة
- صفحة عامة: `/success-partners` (+ alias `/partners`).
- نموذج تقديم شريك مع Validation عربي.
- إضافة رابط البرنامج في Navbar/Footer.
- إضافة Tracking client component يلتقط `ref` ويستدعي API التقاط الإحالة.

### الإدارة
داخل `/admin` تم إضافة تبويب **شركاء النجاح** ويحتوي:
- Applications
- Partners
- Commissions
- Payouts
- Audit Logs

### الدفع
- Endpoint إنشاء عملية Tap: `/app/api/tap/create-charge`.
- Webhook Tap: `/api/tap/webhook`.
- صفحة نتيجة الدفع: `/app/billing/result`.

## 3) الجداول (Migration)
تمت إضافة migration:
- `supabase/migrations/20260312193000_success_partners_tap.sql`

وتشمل:
- `partner_applications`
- `partners`
- `partner_clicks`
- `partner_leads`
- `partner_commissions`
- `partner_payouts`
- `partner_audit_logs`
- `tap_payments`
- `tap_webhook_events`

بالإضافة إلى:
- فهارس (indexes) مهمة.
- قيود uniqueness لمنع التكرار.
- Triggers لتحديث `updated_at`.
- RLS policies (admin-first + public insert لطلبات التقديم).
- دعم خطط تسعير المشروع الحالية (`SMALL_OFFICE`, `MEDIUM_OFFICE`, `ENTERPRISE`) في جدول `plans`.

## 4) منطق الإحالة (Referral)

### الالتقاط عند الزيارة
- عند وجود `?ref=...`:
  - يتم التحقق من الكود.
  - إنشاء click في `partner_clicks`.
  - إنشاء lead أولي بحالة `visited`.
  - حفظ الإحالة في Cookies:
    - `masar_ref_code`
    - `masar_ref_partner_id`
    - `masar_ref_session_id`
    - `masar_ref_click_id`
    - `masar_ref_captured_at`
  - حفظ نسخة احتياطية في LocalStorage: `masar_referral`.

### الربط مع التسجيل/التجربة
- عند `signup` يتم محاولة `upsert` لـ lead بحالة `signed_up`.
- عند `start-trial` (حساب موجود/مفعل) يتم ترقية الحالة إلى `trial_started`.
- First-touch attribution:
  - إذا يوجد attribution سابق لا يتم استبداله لشريك آخر.
- Attribution window:
  - افتراضيًا 30 يوم (قابل للتعديل عبر env).

### منع التلاعب
- حظر self-referral عبر:
  - تطابق بريد العميل مع بريد الشريك.
  - أو تطابق `partner.user_id` مع `customer_user_id`.
- حظر أساسي للحسابات المعلقة (`suspended`) من احتساب العمولة.

## 5) منطق Tap

### إنشاء Charge
- `POST /app/api/tap/create-charge`
- يستقبل الخطة والفترة.
- يحسب المبلغ من خطط المشروع.
- ينشئ Charge في Tap ويُرجع `payment_url`.
- يسجل العملية مبدئيًا في `tap_payments`.

### Webhook (مصدر الحقيقة النهائي)
- `POST /api/tap/webhook`
- يتحقق من التوقيع (`hashstring` HMAC-SHA256).
- يخزن payload خام في `tap_webhook_events`.
- يحدث `tap_payments`.
- عند `captured`:
  - تفعيل/تحديث الاشتراك في `subscriptions`.
  - تسجيل `subscription_events`.
  - إنشاء عمولة إذا attribution مؤهل.
- عند `failed/cancelled/refunded`:
  - عكس العمولة (`reversed`) إذا كانت موجودة.
  - تحديث الحالة ذات الصلة.

## 6) منطق العمولة
- عند دفع ناجح (Tap Captured):
  - `base_amount` = قيمة الاشتراك المدفوع.
  - `partner_rate` = 5% (افتراضي، قابل للتغيير لكل شريك).
  - `marketing_rate` = 5% (افتراضي، قابل للتغيير لكل شريك).
  - الحالة الابتدائية: `pending`.
- لا عمولة على:
  - التسجيل فقط.
  - التجربة المجانية فقط.
  - self-referral.
  - الحالات المعكوسة (refund/cancel) تتحول `reversed`.

## 7) اعتماد الشريك من الأدمن
- من `/admin` → شركاء النجاح → Applications.
- أزرار: `approve / reject / needs_review`.
- عند `approve`:
  - إنشاء شريك في `partners`.
  - توليد `partner_code` فريد.
  - توليد `referral_link` فريد.
  - تسجيل audit log.

## 8) توليد الكود والرابط
- الكود: `MASAR-XXXXXX` (حروف/أرقام مقروءة).
- الرابط: `https://<site>/?ref=MASAR-XXXXXX`.
- منع التكرار:
  - عبر `unique constraints` في DB.
  - وعبر إعادة التوليد تلقائيًا في التطبيق.

## 9) البريد (إشعار الإدارة)
- عند تقديم طلب شريك جديد يتم إرسال بريد بعنوان:
  - **"طلب جديد في شركاء النجاح"**
- عبر abstraction: `lib/partners/mail-provider.ts`.
- إذا SMTP غير مفعّل: النظام لا يتعطل (graceful fallback + warning log).

## 10) ENV المطلوبة
أضف القيم التالية:
- `PARTNER_ALERT_EMAILS`
- `TAP_SECRET_KEY`
- `NEXT_PUBLIC_TAP_PUBLIC_KEY`
- `TAP_WEBHOOK_SECRET` (أو fallback إلى `TAP_SECRET_KEY`)
- `TAP_API_BASE_URL` (افتراضي `https://api.tap.company/v2`)
- `TAP_SOURCE_ID` (افتراضي `src_all`)
- `REFERRAL_ATTRIBUTION_WINDOW_DAYS` (افتراضي `30`)
- `REFERRAL_IP_HASH_SALT` (اختياري؛ fallback إلى JWT secret)

## 11) الاختبارات
تمت إضافة اختبارات منطقية في:
- `apps/web/lib/partners/tests/partners-core.test.ts`

وتغطي:
- Partner code generation pattern/uniqueness.
- Referral parsing.
- Attribution window checks.
- Self-referral blocking.
- Commission calculation.
- Tap status normalization.
- Webhook charge parsing.

تشغيلها:
```bash
npm run test:partners --workspace @masar/web
```

## 12) Manual QA Checklist
1. افتح `/?ref=MASAR-XXXXXX` وتحقق من:
   - وجود click في `partner_clicks`.
   - وجود lead `visited` في `partner_leads`.
2. نفّذ signup/start-trial بنفس المتصفح وتحقق من:
   - ترقية lead إلى `signed_up` أو `trial_started`.
3. أنشئ Charge عبر Tap من صفحة التسعير.
4. أرسل Webhook captured (Sandbox) وتحقق من:
   - تحديث `tap_payments`.
   - تفعيل `subscriptions`.
   - إنشاء `partner_commissions`.
5. أرسل Webhook refunded/cancelled وتحقق من:
   - `partner_commissions.status = reversed`.
6. من لوحة `/admin`:
   - راجع approve/reject في Applications.
   - جرّب regenerate/deactivate/reactivate.
   - جرّب تحديث حالة عمولة.
   - جرّب تحديث حالة payout.
   - راجع Audit Logs.

## 13) TODOs / قيود حالية
- Recurring auto-charge scheduler لم يُفعّل بالكامل بعد (Scaffold جاهز في `createTapRecurringCharge`).
- ربط تلقائي `partners.user_id` بالحساب الشريك يحتاج سياسة تفعيل/دعوة نهائية من الأعمال.
- واجهة إنشاء payout جديدة (Create payout) يمكن توسيعها لاحقًا حسب دورة الصرف المالية.
- التحقق المتقدم من fraud (device fingerprint / risk scoring) غير مفعّل في هذه النسخة.
