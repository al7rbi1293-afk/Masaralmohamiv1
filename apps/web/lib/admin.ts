/**
 * Admin guard helpers.
 * Uses the app_admins table to check super-admin status.
 */
import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

/**
 * Check if the current authenticated user is a super admin.
 */
export async function isAppAdmin(): Promise<boolean> {
    const user = await getCurrentAuthUser();
    if (!user) return false;

    const supabase = createSupabaseServerRlsClient();
    const { data } = await supabase
        .from('app_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

    return !!data;
}

/**
 * Require the current user to be a super admin.
 * Returns the user id if admin, otherwise throws.
 */
export async function requireAdmin(): Promise<string> {
    const user = await getCurrentAuthUser();
    if (!user) {
        throw new Error('not_authenticated');
    }

    const supabase = createSupabaseServerRlsClient();
    const { data } = await supabase
        .from('app_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (!data) {
        throw new Error('not_admin');
    }

    return user.id;
}
