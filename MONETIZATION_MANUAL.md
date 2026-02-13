# Monetization (Manual Activation) — Phase 8.2

هذه المرحلة تضيف تفعيل الاشتراك يدويًا بدون بوابة دفع.

## المتطلبات
1) تطبيق مِجريشن الاشتراكات:
- `supabase/migrations/0015_subscriptions_foundation.sql`

2) ضبط متغيرات البيئة (Vercel + محليًا)
- `ADMIN_ACTIVATION_SECRET`:
  - سر داخلي لتفعيل الاشتراكات من خلال Endpoint إداري.
  - اجعله طويلًا وعشوائيًا (مثال: 32+ حرف).

> ملاحظة: هذا السر لا يجب أن يظهر في أي كود للواجهة.

## رحلة المستخدم (Owner)
1) يدخل المالك إلى:
- `/app/settings/subscription`

2) ينسخ **معرّف المكتب (org_id)** عبر زر:
- "نسخ معرّف المكتب"

3) يرسل المعرّف للدعم لتفعيل الاشتراك يدويًا.
يمكن أيضًا إرسال "طلب تفعيل الاشتراك" من نفس الصفحة (يتم حفظه كطلب تفعيل).

## طريقة التفعيل (Admin)
يوجد Endpoint إداري:
- `POST /api/admin/activate-subscription`

### الهيدر المطلوب
- `x-admin-secret: <ADMIN_ACTIVATION_SECRET>`

### Body (JSON)
```json
{
  "org_id": "UUID",
  "plan_code": "SOLO",
  "seats": 1,
  "period_days": 30
}
```

### مثال curl
```bash
curl -X POST "https://YOUR_DOMAIN/api/admin/activate-subscription" \
  -H "content-type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_ACTIVATION_SECRET" \
  -d '{"org_id":"ORG_UUID","plan_code":"TEAM","seats":5,"period_days":30}'
```

## ماذا يحدث عند التفعيل؟
- يتم Upsert لسجل `subscriptions` للمكتب (org):
  - `status = active`
  - `current_period_start = now`
  - `current_period_end = now + period_days`
  - `provider = manual`
- يتم إضافة حدث في `subscription_events`:
  - `type = activated_manual`

## التحقق بعد التفعيل
1) سجّل دخول كمالك.
2) افتح `/app/settings/subscription`.
3) تأكد أن الحالة أصبحت "نشط" وأن تاريخ نهاية الفترة يظهر.
4) إذا كانت التجربة منتهية، يجب أن يسمح لك بالدخول للمنصة طالما الاشتراك نشط.

## ملاحظات أمان
- هذا endpoint يجب اعتباره "داخلي" ولا يشارك إلا مع فريق الإدارة.
- بدّل/دوّر `ADMIN_ACTIVATION_SECRET` عند الحاجة.
- لا تضع السر في `NEXT_PUBLIC_*`.

