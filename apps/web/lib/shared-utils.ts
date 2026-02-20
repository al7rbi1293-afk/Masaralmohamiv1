'use server';

/**
 * Shared utility functions used across multiple server actions and API routes.
 * Consolidated from duplicated implementations to follow DRY principle.
 */

// ────────────────────────────────────────────
// UUID Validation
// ────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
    return UUID_RE.test(value);
}

// ────────────────────────────────────────────
// Empty-to-null normalization
// ────────────────────────────────────────────

export function emptyToNull(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
}

// ────────────────────────────────────────────
// Error detection helpers
// ────────────────────────────────────────────

/** Check if a Supabase error indicates a missing table/relation (migration not applied). */
export function isMissingRelationError(message?: string): boolean {
    if (!message) return false;
    const normalized = message.toLowerCase();
    return normalized.includes('does not exist') || normalized.includes('relation');
}

// ────────────────────────────────────────────
// User-facing error message normalization
// ────────────────────────────────────────────

/**
 * Convert an unknown error into a safe, user-facing Arabic message.
 * NEVER returns raw error messages to prevent leaking DB internals.
 */
export function toUserMessage(error: unknown, fallback = 'تعذر الحفظ. حاول مرة أخرى.'): string {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    const normalized = message.toLowerCase();

    // Known Arabic messages from our own code — re-surface them
    if (message.includes('لا يوجد مكتب مفعّل')) return message;
    if (message.includes('لا تملك صلاحية')) return message;
    if (message.includes('غير موجود')) return message;

    // Permission / RLS errors
    if (
        normalized.includes('permission denied') ||
        normalized.includes('not allowed') ||
        normalized.includes('violates row-level security')
    ) {
        return 'لا تملك صلاحية لهذا الإجراء.';
    }

    // Not found
    if (
        normalized.includes('no rows') ||
        normalized.includes('not found') ||
        normalized.includes('not_found') ||
        normalized.includes('pgrst116')
    ) {
        return 'العنصر غير موجود.';
    }

    // Foreign key constraint
    if (normalized.includes('foreign key constraint')) {
        return 'لا يمكن الحذف لأن العنصر مرتبط ببيانات أخرى.';
    }

    // Never leak raw error messages
    return fallback;
}
