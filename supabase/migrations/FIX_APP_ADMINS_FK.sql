-- مرحلة 8 (إضافية): تحديث مفتاح app_admins ليرتبط بـ app_users بدلاً من auth.users
-- 1. فك الارتباط القديم
ALTER TABLE public.app_admins DROP CONSTRAINT IF EXISTS app_admins_user_id_fkey;
-- 2. توجيه الارتباط الجديد إلى جدول app_users
ALTER TABLE public.app_admins
ADD CONSTRAINT app_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;
-- تم التوجيه بنجاح. الآن يمكنك إضافة الأدمن عبر الاستعلام التالي:
-- INSERT INTO public.app_admins (user_id)
-- SELECT id FROM public.app_users WHERE email = 'YOUR_EMAIL'
-- ON CONFLICT DO NOTHING;