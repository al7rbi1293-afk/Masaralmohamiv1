import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createTemplate } from '@/lib/templates';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';
import { TEMPLATE_PRESETS } from '@/lib/templatePresets';

const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'اسم القالب مطلوب ويجب أن لا يقل عن حرفين.')
    .max(200, 'اسم القالب طويل جدًا.'),
  category: z.string().trim().max(80, 'التصنيف طويل جدًا.').optional().or(z.literal('')),
  description: z.string().trim().max(2000, 'الوصف طويل جدًا.').optional().or(z.literal('')),
  preset_code: z.string().trim().max(50, 'رمز القالب الجاهز طويل جدًا.').optional().or(z.literal('')),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = createTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر إنشاء القالب.' },
        { status: 400 },
      );
    }

    const presetCode = parsed.data.preset_code ? parsed.data.preset_code.trim().toUpperCase() : '';
    let presetVariables: any[] | null = null;
    let presetCategory: string | null = null;

    if (presetCode) {
      const preset = TEMPLATE_PRESETS.find((p) => String(p.code || '').toUpperCase() === presetCode) ?? null;
      if (preset) {
        presetCategory = String(preset.category ?? '').trim() || null;
        presetVariables = Array.isArray(preset.variables) ? (preset.variables as any[]) : [];
      }
    }

    const created = await createTemplate({
      name: parsed.data.name,
      category: (parsed.data.category || presetCategory || 'عام').trim() || 'عام',
      description: parsed.data.description ? parsed.data.description : null,
    });

    await logAudit({
      action: 'template.created',
      entityType: 'template',
      entityId: created.id,
      meta: {
        template_type: created.template_type,
        category: created.category,
        preset_code: presetCode || null,
      },
      req: request,
    });

    logInfo('template_created', { templateId: created.id });

    return NextResponse.json(
      { template: created, presetVariables: presetVariables ?? undefined },
      { status: 200 },
    );
  } catch (error) {
    const message = toUserMessage(error);
    logError('template_create_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: message }, { status: statusForError(error) });
  }
}

function statusForError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();
  if (normalized.includes('not_authenticated')) return 401;
  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security')
  ) {
    return 403;
  }
  return 500;
}

function toUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (normalized.includes('not_authenticated')) {
    return 'الرجاء تسجيل الدخول.';
  }

  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security')
  ) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }

  return 'تعذر إنشاء القالب.';
}
