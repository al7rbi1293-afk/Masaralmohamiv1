/**
 * Admin guard helpers.
 * Uses the app_admins table to check super-admin status.
 */
import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import {
    fetchAppAdminContextForUser,
    hasAdminPermissions,
    type AppAdminContext,
    type AppAdminPermission,
} from '@/lib/admin-rbac';

export type { AppAdminContext, AppAdminPermission, AppAdminRole } from '@/lib/admin-rbac';

export async function getUserAppAdminContext(userId: string): Promise<AppAdminContext | null> {
    const supabase = createSupabaseServerRlsClient();
    return fetchAppAdminContextForUser(supabase, userId);
}

export async function isUserAppAdmin(userId: string): Promise<boolean> {
    return Boolean(await getUserAppAdminContext(userId));
}

/**
 * Check if the current authenticated user is a super admin.
 */
export async function isAppAdmin(): Promise<boolean> {
    const user = await getCurrentAuthUser();
    if (!user) return false;

    return isUserAppAdmin(user.id);
}

export async function getCurrentAppAdminContext() {
    const user = await getCurrentAuthUser();
    if (!user) {
        return null;
    }

    return getUserAppAdminContext(user.id);
}

export async function requireAdminContext(requiredPermissions?: AppAdminPermission | AppAdminPermission[]) {
    const user = await getCurrentAuthUser();
    if (!user) {
        throw new Error('not_authenticated');
    }

    const context = await getUserAppAdminContext(user.id);
    if (!context) {
        throw new Error('not_admin');
    }

    if (requiredPermissions && !hasAdminPermissions(context.permissions, requiredPermissions)) {
        throw new Error('not_admin_permission');
    }

    return context;
}

/**
 * Require the current user to be a super admin.
 * Returns the user id if admin, otherwise throws.
 */
export async function requireAdmin(requiredPermissions?: AppAdminPermission | AppAdminPermission[]): Promise<string> {
    const context = await requireAdminContext(requiredPermissions);
    return context.userId;
}
