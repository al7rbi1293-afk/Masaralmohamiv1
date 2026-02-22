-- ⚠️ حذف جميع المستخدمين الحاليين
-- شغّل هذا في Supabase SQL Editor قبل تنفيذ 0010_custom_users.sql
-- 1. حذف العضويات
DELETE FROM public.memberships;
-- 2. حذف الملفات الشخصية
DELETE FROM public.profiles;
-- 3. حذف app_users (إذا كان الجدول موجوداً)
DELETE FROM public.app_users;
-- 4. حذف المستخدمين من auth.users (Supabase Auth)
DELETE FROM auth.users;
-- 5. حذف التجارب
DELETE FROM public.trial_subscriptions;
-- 6. حذف المؤسسات
DELETE FROM public.organizations;
-- تم حذف جميع المستخدمين والبيانات المرتبطة ✅