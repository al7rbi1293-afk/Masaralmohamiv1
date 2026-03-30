# Masar Mobile

تطبيق Expo/React Native لمنصة `مسار المحامي`، مرتبط بنفس:

- قاعدة البيانات الحالية
- أنظمة المكتب الحالية
- واجهات الـ API داخل `apps/web`

الموقع الحالي لا يحتاج أي تغيير في السلوك حتى يعمل التطبيق.

## المتطلبات

انسخ القيم المناسبة داخل بيئة Expo:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

إذا كان الويب يعمل على دومين الإنتاج، ضع رابط الإنتاج بدل `localhost`.

## التشغيل

من جذر المشروع:

```bash
npm run mobile:start
npm run mobile:ios
npm run mobile:android
```

أو من داخل `apps/mobile`:

```bash
npm run start
npm run ios
npm run android
```

## نشر iPhone / TestFlight

من جذر المشروع:

```bash
npm run mobile:ios:build
npm run mobile:ios:submit
```

أو من داخل `apps/mobile`:

```bash
npm run ios:store
npm run ios:submit
```

تفاصيل إعداد App Store Connect وملاحظات المراجعة موجودة في:

- `apps/mobile/IOS_RELEASE.md`

## ماذا يستخدم التطبيق؟

- دخول فريق المكتب عبر `POST /api/mobile/auth/signin`
- بوابة العميل عبر OTP وربط `POST /api/mobile/client-portal/verify-otp`
- لوحة المكتب عبر `GET /api/mobile/office/bootstrap`
- القضايا عبر `GET /api/mobile/office/matters`
- تفاصيل القضية عبر `GET /api/mobile/office/matters/[id]`
- بوابة الشريك عبر `GET /api/mobile/partner/bootstrap`

## ملاحظة

أي تحديث في بيانات النظام على الموقع سيظهر في التطبيق لأن المصدر واحد، والتطبيق لا يملك قاعدة بيانات منفصلة.
