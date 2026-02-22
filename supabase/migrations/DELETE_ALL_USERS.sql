-- ⚠️ حذف جميع المستخدمين والبيانات المرتبطة
-- شغّل هذا في Supabase SQL Editor قبل تنفيذ 0010_custom_users.sql
-- حذف كل البيانات المرتبطة بالمستخدمين (بالترتيب الصحيح لتفادي FK errors)
TRUNCATE public.doc_generations CASCADE;
TRUNCATE public.calendar_event_attendees CASCADE;
TRUNCATE public.calendar_events CASCADE;
TRUNCATE public.email_integration_accounts CASCADE;
TRUNCATE public.email_log CASCADE;
TRUNCATE public.najiz_packets CASCADE;
TRUNCATE public.najiz_sync_runs CASCADE;
TRUNCATE public.template_documents CASCADE;
TRUNCATE public.template_fields CASCADE;
TRUNCATE public.templates CASCADE;
TRUNCATE public.integrations CASCADE;
TRUNCATE public.document_versions CASCADE;
TRUNCATE public.documents CASCADE;
TRUNCATE public.matter_events CASCADE;
TRUNCATE public.matter_team CASCADE;
TRUNCATE public.tasks CASCADE;
TRUNCATE public.matters CASCADE;
TRUNCATE public.clients CASCADE;
TRUNCATE public.org_invitations CASCADE;
TRUNCATE public.invoices CASCADE;
TRUNCATE public.billing_audit CASCADE;
TRUNCATE public.subscriptions CASCADE;
TRUNCATE public.payment_requests CASCADE;
TRUNCATE public.full_version_requests CASCADE;
TRUNCATE public.audit_log CASCADE;
TRUNCATE public.app_admins CASCADE;
TRUNCATE public.memberships CASCADE;
TRUNCATE public.profiles CASCADE;
TRUNCATE public.trial_subscriptions CASCADE;
TRUNCATE public.organizations CASCADE;
TRUNCATE public.leads CASCADE;
-- حذف من app_users (إذا كان موجوداً)
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name = 'app_users'
) THEN EXECUTE 'TRUNCATE public.app_users CASCADE';
END IF;
END $$;
-- حذف المستخدمين من auth.users
DELETE FROM auth.users;
-- تم حذف جميع البيانات ✅