-- ⚠️ حذف جميع المستخدمين والبيانات المرتبطة
-- يتجاهل تلقائياً أي جدول غير موجود
DO $$
DECLARE t TEXT;
tables TEXT [] := ARRAY [
    'doc_generations',
    'calendar_event_attendees',
    'calendar_events',
    'email_integration_accounts',
    'email_log',
    'najiz_packets',
    'najiz_sync_runs',
    'template_documents',
    'template_fields',
    'templates',
    'integrations',
    'document_versions',
    'documents',
    'matter_events',
    'matter_team',
    'tasks',
    'matters',
    'clients',
    'org_invitations',
    'invoices',
    'billing_audit',
    'subscriptions',
    'payment_requests',
    'full_version_requests',
    'audit_log',
    'app_admins',
    'memberships',
    'profiles',
    'trial_subscriptions',
    'organizations',
    'leads',
    'app_users'
  ];
BEGIN FOREACH t IN ARRAY tables LOOP BEGIN EXECUTE format('TRUNCATE public.%I CASCADE', t);
RAISE NOTICE 'Truncated: %',
t;
EXCEPTION
WHEN undefined_table THEN RAISE NOTICE 'Skipped (not found): %',
t;
END;
END LOOP;
END $$;
-- حذف المستخدمين من auth.users
DELETE FROM auth.users;
-- تم ✅