import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createTemplate } from '@/lib/templates';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'اسم القالب مطلوب ويجب أن لا يقل عن حرفين.')
    .max(200, 'اسم القالب طويل جدًا.'),
  category: z.string().trim().max(80, 'التصنيف طويل جدًا.').optional().or(z.literal('')),
  template_type: z.enum(['docx', 'pdf']).optional(),
  description: z.string().trim().max(2000, 'الوصف طويل جدًا.').optional().or(z.literal('')),
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

    const created = await createTemplate({
      name: parsed.data.name,
      category: parsed.data.category || 'عام',
      template_type: parsed.data.template_type ?? 'docx',
      description: parsed.data.description ? parsed.data.description : null,
    });

    await logAudit({
      action: 'template.created',
      entityType: 'template',
      entityId: created.id,
      meta: {
        template_type: created.template_type,
        category: created.category,
      },
      req: request,
    });

    logInfo('template_created', { templateId: created.id });

    return NextResponse.json({ template: created }, { status: 200 });
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

