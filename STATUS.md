# STATUS / Monitoring (Phase 9.3.0)

هذا الملف يوضح نقاط الفحص الأساسية (Health) وكيفية مراقبة الأخطاء في الإنتاج.

## 1) Health endpoint

- Endpoint: `GET /api/health`
- مثال:
  - `https://masaralmohamiproject-pied.vercel.app/api/health`

يرجع:
```json
{ "ok": true, "time": "...", "version": "..." }
```

ملاحظات:
- لا يُرجع أسرار أو بيانات حساسة.
- `version` يعتمد على:
  - `APP_VERSION` (مستقبلاً في Phase 9.5.0)
  - أو `VERCEL_GIT_COMMIT_SHA`
  - أو نسخة الحزمة أثناء البناء.

## 2) Error tracking (Sentry)

المشروع يدعم تتبع الأخطاء عبر Sentry بشكل اختياري:
- ضع المتغير:
  - `NEXT_PUBLIC_SENTRY_DSN` (للعميل + الخادم)
  - أو `SENTRY_DSN` (للخادم فقط)

سيتم:
- التقاط أخطاء الواجهة (runtime errors).
- التقاط أخطاء الخادم (route handlers / server components) حسب تكامل Sentry.

## 3) حماية الخصوصية (PII)

الإعدادات الحالية تمنع إرسال PII بشكل افتراضي:
- `sendDefaultPii: false`
- حذف headers/cookies/body من request داخل `beforeSend`
- إزالة `user` من الأحداث

**مهم:** لا نرسل محتوى المستندات أو بيانات النماذج الخام.

## 4) أين أرى السجلات؟

على Vercel:
- Project -> Deployments -> Logs

على Sentry:
- Issues -> تُظهر الأخطاء حسب البيئة.

