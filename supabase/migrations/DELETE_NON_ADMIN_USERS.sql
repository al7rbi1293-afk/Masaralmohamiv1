-- Deletes all users except the specific admin email
-- This cascades to all related data (subscriptions, cases, etc.) because of foreign keys on delete cascade.
DELETE FROM auth.users
WHERE email NOT IN (
        'Masar.almohami@outlook.sa',
        'masar.almohami@outlook.sa'
    );
-- Also clean up public tables just in case (though cascade should handle it)
-- DELETE FROM public.users WHERE email NOT IN ('Masar.almohami@outlook.sa', 'masar.almohami@outlook.sa');