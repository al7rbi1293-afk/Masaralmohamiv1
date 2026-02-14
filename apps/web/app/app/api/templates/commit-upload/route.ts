import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

const variableSchema = z.object({
  key: z.string().trim().min(1, 'مفتاح المتغير مطلوب.').max(120, 'مفتاح المتغير طويل جدًا.'),
  label_ar: z.string().trim().min(1, 'اسم المتغير مطلوب.').max(120, 'اسم المتغير طويل جدًا.'),
  required: z.boolean().default(false),
  source: z.enum(['client', 'matter', 'manual']),
});

const commitSchema = z.object({
  template_id: z.string().uuid(),
  version_no: z.number().int().positive('رقم النسخة غير صالح.'),
  storage_path: z.string().trim().min(1, 'مسار التخزين مطلوب.').max(800, 'مسار التخزين طويل جدًا.'),
  file_name: z.string().trim().min(1, 'اسم الملف مطلوب.').max(255, 'اسم الملف طويل جدًا.'),
  file_size: z.number().int().positive('حجم الملف غير صالح.'),
  mime_type: z.string().trim().max(150).optional().or(z.literal('')),
  variables: z.array(variableSchema).max(200, 'عدد المتغيرات كبير جدًا.').optional().default([]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = commitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر حفظ نسخة القالب.' },
        { status: 400 },
      );
    }

    const orgId = await requireOrgIdForUser();
    const user = await getCurrentAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
    }

    const rls = createSupabaseServerRlsClient();

    const { data: template, error: templateError } = await rls
      .from('templates')
      .select('id, org_id')
      .eq('org_id', orgId)
      .eq('id', parsed.data.template_id)
      .maybeSingle();

    if (templateError) {
      logError('template_commit_failed', { message: templateError.message });
      return NextResponse.json({ error: 'تعذر حفظ نسخة القالب.' }, { status: 400 });
    }

    if (!template) {
      return NextResponse.json({ error: 'لا تملك صلاحية الوصول.' }, { status: 403 });
    }

    const { data: existing, error: existingError } = await rls
      .from('template_versions')
      .select('id, storage_path, file_name, file_size, mime_type')
      .eq('org_id', orgId)
      .eq('template_id', parsed.data.template_id)
      .eq('version_no', parsed.data.version_no)
      .maybeSingle();

    if (existingError) {
      logError('template_commit_lookup_failed', { message: existingError.message });
      return NextResponse.json({ error: 'تعذر حفظ نسخة القالب.' }, { status: 400 });
    }

    let saved: any = null;

    if (existing?.id) {
      const { data: updated, error: updateError } = await rls
        .from('template_versions')
        .update({
          variables: parsed.data.variables,
        })
        .eq('org_id', orgId)
        .eq('id', existing.id)
        .select(
          'id, org_id, template_id, version_no, storage_path, file_name, file_size, mime_type, variables, uploaded_by, created_at',
        )
        .single();

      if (updateError || !updated) {
        const message = toUserMessage(updateError ?? undefined);
        logError('template_commit_update_failed', { message: updateError?.message ?? 'unknown' });
        return NextResponse.json({ error: message }, { status: statusForError(updateError) });
      }

      saved = updated;
    } else {
      const { data: inserted, error: insertError } = await rls
        .from('template_versions')
        .insert({
          org_id: orgId,
          template_id: parsed.data.template_id,
          version_no: parsed.data.version_no,
          storage_path: parsed.data.storage_path,
          file_name: parsed.data.file_name,
          file_size: parsed.data.file_size,
          mime_type: emptyToNull(parsed.data.mime_type),
          variables: parsed.data.variables,
          uploaded_by: user.id,
        })
        .select(
          'id, org_id, template_id, version_no, storage_path, file_name, file_size, mime_type, variables, uploaded_by, created_at',
        )
        .single();

      if (insertError || !inserted) {
        const message = toUserMessage(insertError ?? undefined);
        logError('template_commit_insert_failed', { message: insertError?.message ?? 'unknown' });
        return NextResponse.json({ error: message }, { status: statusForError(insertError) });
      }

      saved = inserted;
    }

    logInfo('template_version_committed', {
      templateId: parsed.data.template_id,
      versionNo: parsed.data.version_no,
    });

    await logAudit({
      action: 'template.version_committed',
      entityType: 'template',
      entityId: parsed.data.template_id,
      meta: { version_no: parsed.data.version_no, file_size: parsed.data.file_size },
      req: request,
    });

    return NextResponse.json({ version: saved }, { status: 200 });
  } catch (error) {
    logError('template_commit_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر حفظ نسخة القالب.' }, { status: 500 });
  }
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function statusForError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();
  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security')
  ) {
    return 403;
  }
  return 400;
}

function toUserMessage(error?: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();
  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security')
  ) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }
  return 'تعذر حفظ نسخة القالب.';
}

