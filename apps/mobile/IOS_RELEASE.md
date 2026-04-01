# iOS Release Checklist

مرجع عملي لإطلاق تطبيق `Masar Al-Muhami` على iPhone عبر `EAS` و `App Store Connect`.

## بيانات التطبيق الحالية

- App name: `Masar Al-Muhami`
- Expo slug: `masar-al-muhami-mobile`
- EAS project: `@abdulazizalhazmi/masar-al-muhami-mobile`
- EAS project ID: `6706a16c-17ff-4819-a95b-d4b2f1ed1205`
- iOS bundle identifier: `com.masaralmuhami.mobile`
- URL scheme: `masar`
- Current marketing version: `1.0.0`
- Production API base URL: `https://masaralmohami.com`

## روابط App Store Connect

- Marketing URL: `https://masaralmohami.com`
- Support URL: `https://masaralmohami.com/contact`
- Privacy Policy URL: `https://masaralmohami.com/privacy`
- Terms of Service URL: `https://masaralmohami.com/terms`
- Account deletion help URL: `https://masaralmohami.com/account-deletion`

## أوامر البناء والرفع

من جذر المشروع:

```bash
npm run mobile:ios:setup
npm run mobile:ios:build
npm run mobile:ios:submit
```

من داخل `apps/mobile`:

```bash
npm run ios:setup
npm run ios:store
npm run ios:submit
```

`ios:setup` مخصص لأول مرة فقط أو عند الحاجة إلى إعداد/تحديث شهادات Apple بشكل تفاعلي.
بعد اكتمال الشهادات استخدم `ios:store` للبناء غير التفاعلي.

## ما يلزم في App Store Connect

1. أنشئ التطبيق بنفس `bundle identifier`:
   `com.masaralmuhami.mobile`
2. اختر اسم التطبيق:
   `Masar Al-Muhami`
3. أضف روابط:
   - Support URL
   - Privacy Policy URL
   - Marketing URL
4. جهّز لقطات شاشة iPhone:
   يفضل `6.7"` و `6.5"` كبداية.
5. جهّز وصف مختصر ووصف كامل وكلمات مفتاحية.
6. أضف ملاحظة للمراجعة عن طريقة الدخول وحذف الحساب.

## ملاحظات مقترحة لفريق Apple Review

- التطبيق مرتبط بنفس خدمة الويب الإنتاجية على `https://masaralmohami.com`.
- يمكن تجهيز حساب مراجعة مخصص يعمل بالبريد الإلكتروني وكلمة المرور فقط بدون OTP، وذلك بإضافة بريده إلى `MOBILE_PASSWORD_SIGNIN_ALLOWLIST` في بيئة الويب/الخادم.
- حذف الحساب متاح من داخل التطبيق بعد تسجيل الدخول.
- صفحات الحذف والدعم العامة:
  - `https://masaralmohami.com/account-deletion`
  - `https://masaralmohami.com/contact`

لإعداد حساب المراجعة:

1. أنشئ حساب مكتب/إدارة مخصص للمراجعة بكلمة مرور ثابتة.
2. أضف بريده الإلكتروني إلى `MOBILE_PASSWORD_SIGNIN_ALLOWLIST` على بيئة الإنتاج.
3. قدّم إلى Apple البريد الإلكتروني وكلمة المرور فقط؛ الحساب المسموح له لن يُطلب منه OTP داخل التطبيق.

صياغة جاهزة:

```text
Users can request account deletion directly inside the app after signing in.
Office users can open the More/Control area and choose the delete-account action.
Client, partner, and admin users also have the same delete-account request action inside their account screens.
For App Review, we provided a dedicated account that signs in with email and password only and does not require OTP.
For review reference, support and deletion details are published at:
https://masaralmohami.com/account-deletion
https://masaralmohami.com/contact
```

## ملاحظات تشغيلية

- تم ضبط `storeIos` داخل `apps/mobile/eas.json` للبناء المتجر.
- `autoIncrement` مفعل في EAS للإصدارات الإنتاجية.
- أيقونة التطبيق `1024x1024` وتمت إزالة `alpha` منها لتفادي رفض الرفع.
