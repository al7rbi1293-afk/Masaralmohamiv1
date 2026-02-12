# Deployment Guide (Vercel)

هذا الدليل يجهز مشروع **مسار المحامي** للنشر على Vercel.

## Prerequisites

- GitHub repo: `https://github.com/MasarAlmohami/Masaralmohamiproject`
- Supabase project جاهز (URL + keys)

## Required Environment Variables

اضبط هذه المتغيرات في Vercel (Production + Preview):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

ملاحظة: بعد أول نشر، اضبط `NEXT_PUBLIC_SITE_URL` على رابط الإنتاج في Vercel ثم أعد النشر لتحديث canonical وOpenGraph وsitemap وrobots.

## Method 1: Vercel Dashboard (UI)

1. افتح Vercel Dashboard ثم `Add New` -> `Project`.
2. اختر `Import Git Repository` واربط:
   - `https://github.com/MasarAlmohami/Masaralmohamiproject`
3. إعدادات المشروع:
   - Framework Preset: `Next.js`
   - Root Directory: `apps/web`
   - Install Command: `npm install`
   - Build Command: `npm run build`
4. أضف Environment Variables (لكل من Preview وProduction):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`
5. اضغط Deploy.
6. بعد أول Deploy:
   - انسخ رابط الإنتاج (مثال: `https://your-project.vercel.app`)
   - حدث `NEXT_PUBLIC_SITE_URL` بهذه القيمة
   - أعد النشر Redeploy.

## Method 2: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_SITE_URL
vercel --prod
```

ملاحظة: إذا كانت `NEXT_PUBLIC_SITE_URL` لم تُضبط بعد رابط الإنتاج الحقيقي، حدّثها بعد أول نشر ثم نفّذ:

```bash
vercel --prod
```

## Smoke Test Checklist

1. افتح `/` وتأكد أن الصفحة تعمل وRTL صحيح.
2. اضغط زر `جرّب مجانًا 14 يوم` وتأكد أنه ينقلك إلى قسم `#trial`.
3. أرسل نموذج التجربة ببريد جديد:
   - يتم التحويل إلى `/app`
   - تظهر حالة تجربة فعالة وعدد الأيام المتبقية.
4. نفّذ تسجيل خروج ثم تسجيل دخول:
   - حماية `/app` تعمل والتحويل صحيح.
5. اختبار انتهاء التجربة:
   - من Supabase SQL Editor حدث سجل التجربة:
     - اجعل `ends_at` بتاريخ ماضي أو `status='expired'`
   - افتح `/app` وتأكد التحويل إلى `/app/expired`.
6. راجع الصفحات:
   - `/security`
   - `/privacy`
   - `/terms`
   - `/contact`
7. تحقق أن جميع روابط البريد `mailto:` تشير إلى:
   - `masar.almohami@outlook.sa`
8. افتح Console في المتصفح وتأكد عدم وجود أخطاء runtime.
