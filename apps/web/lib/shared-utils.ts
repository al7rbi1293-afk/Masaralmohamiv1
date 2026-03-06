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

export function getErrorText(error: unknown): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;

    const maybeError = error as { message?: string; details?: string; hint?: string };
    return `${maybeError.message ?? ''} ${maybeError.details ?? ''} ${maybeError.hint ?? ''}`.trim();
}

export function isMissingColumnError(error: unknown, table: string, column: string): boolean {
    const message = getErrorText(error);
    if (!message) return false;

    return (
        message.includes(`column "${column}" of relation "${table}" does not exist`) ||
        message.includes(`Could not find the '${column}' column of '${table}' in the schema cache`)
    );
}

// ────────────────────────────────────────────
// User-facing error message normalization
// ────────────────────────────────────────────

/**
 * Convert an unknown error into a safe, user-facing Arabic message.
 * NEVER returns raw error messages to prevent leaking DB internals.
 */
export function toUserMessage(error: unknown, fallback = 'تعذر الحفظ. حاول مرة أخرى.'): string {
    const message = getErrorText(error);
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

    if (normalized.includes('archive_not_supported')) {
        return 'ميزة الأرشفة غير مفعلة في هذه البيئة بعد.';
    }

    // Never leak raw error messages
    return fallback;
}
