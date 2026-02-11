# مسار المحامي | Masar Al-Muhami

منصة SaaS لإدارة مكاتب المحاماة (واجهة عربية RTL + API متعددة المستأجرين).

## مكوّنات المونو-ريبو

- `apps/web`: Next.js (Landing + Signup + Office Portal)
- `apps/api`: NestJS + Prisma + PostgreSQL + Redis + MinIO
- `apps/worker`: BullMQ worker للتذكيرات

## المسارات الأساسية

### الموقع العام
- `/` الصفحة الرئيسية
- `/security` الأمان والخصوصية
- `/privacy` سياسة الخصوصية
- `/terms` الشروط والأحكام
- `/contact` تواصل معنا

### تدفق المكتب
- `/start` إنشاء مكتب جديد (Signup)
- `/app/login` دخول الإدارة
- `/app/{tenantId}/dashboard` لوحة المكتب
- `/app/{tenantId}/clients`
- `/app/{tenantId}/matters`
- `/app/{tenantId}/documents`
- `/app/{tenantId}/tasks`
- `/app/{tenantId}/billing`
- `/app/{tenantId}/settings`
- `/app/{tenantId}/users`

## تدفق التسجيل

1. المستخدم يسجل من `/start`.
2. API ينفذ `POST /auth/signup` ويُنشئ:
   - Tenant جديد
   - User بدور `PARTNER`
3. يعاد JWT يتضمن `tenantId` + `workspaceUrl`.
4. الواجهة تحفظ الجلسة وتحوّل المستخدم إلى:
   - `/app/{tenantId}/dashboard`

## تشغيل محلي (كل الخدمات)

```bash
docker compose up --build
```

الخدمات:
- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001](http://localhost:3001)
- Swagger: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

## تشغيل الويب فقط

```bash
npm install
npm run dev --workspace @masar/web
```

## النشر على Vercel (للواجهة)

1. ارفع المستودع إلى GitHub.
2. في Vercel: Import Project.
3. `Root Directory` = `apps/web`.
4. أضف Environment Variable:
   - `NEXT_PUBLIC_API_URL=https://YOUR_API_DOMAIN`
5. Deploy.

## إعداد API مع Supabase PostgreSQL

في بيئة API (Docker/Render/Railway/Fly):

- `DATABASE_URL` = Connection String الخاص بالـ pooler
- `DIRECT_URL` = Connection String المباشر (للـ Prisma migrations)
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `WEB_BASE_URL` = رابط Vercel
- `CORS_ORIGINS` = رابط Vercel (أو عدة روابط مفصولة بفاصلة)

مهم: إذا كلمة المرور تحتوي `@` يجب ترميزها إلى `%40` داخل الرابط.

أمثلة جاهزة:
- `apps/api/.env.example`
- `apps/web/.env.example`

## ملاحظات

- العزل متعدد المستأجرين مفروض عبر `tenantId` على مستوى الجدول والاستعلام.
- كل JWT يتضمن `tenantId` ويُستخدم على الخادم لكل العمليات.
- روابط المستندات مشاركة/تنزيل موقعة ومؤقتة.
