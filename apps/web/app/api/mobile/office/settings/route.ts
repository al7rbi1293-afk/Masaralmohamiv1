import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOfficeOwnerAppContext } from '@/lib/mobile/auth';
import { getMobileOfficeSettings, updateMobileOfficeSettings } from '@/lib/mobile/office-settings';

export const runtime = 'nodejs';

const identitySchema = z.object({
  name: z.string().trim().min(1, 'اسم المكتب مطلوب.').max(200, 'اسم المكتب طويل جدًا.'),
  tax_number: z.string().trim().max(80).optional().nullable(),
  cr_number: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  logo_url: z.string().trim().max(2048).optional().nullable(),
});

function getSafeString(value: FormDataEntryValue | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function getFileValue(value: FormDataEntryValue | null | undefined) {
  return value instanceof File ? value : null;
}

async function parseIdentityPayload(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const parsed = identitySchema.safeParse({
      name: getSafeString(formData.get('name')),
      tax_number: getSafeString(formData.get('tax_number')) || null,
      cr_number: getSafeString(formData.get('cr_number')) || null,
      address: getSafeString(formData.get('address')) || null,
      logo_url: getSafeString(formData.get('logo_url')) || null,
    });

    if (!parsed.success) {
      return { ok: false as const, status: 400, error: 'بيانات الهوية غير صالحة.' };
    }

    return {
      ok: true as const,
      data: {
        ...parsed.data,
        logo_file: getFileValue(formData.get('logo')) ?? getFileValue(formData.get('logo_file')),
      },
    };
  }

  const body = await request.json().catch(() => ({}));
  const parsed = identitySchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false as const, status: 400, error: 'بيانات الهوية غير صالحة.' };
  }

  return {
    ok: true as const,
    data: {
      ...parsed.data,
      logo_file: null,
    },
  };
}

function resolveSettingsError(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (message === 'missing_org') {
    return { error: 'لا يوجد مكتب مفعّل لهذا الحساب.', status: 403 };
  }

  if (message.includes('صلاحية')) {
    return { error: message, status: 403 };
  }

  if (message.includes('تعذر رفع الشعار')) {
    return { error: message, status: 400 };
  }

  if (message.includes('اسم المكتب مطلوب')) {
    return { error: message, status: 400 };
  }

  return { error: 'تعذر حفظ هوية المكتب.', status: 500 };
}

export async function GET(request: NextRequest) {
  const auth = await requireOfficeOwnerAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const settings = await getMobileOfficeSettings(auth.context);
  return NextResponse.json({ settings });
}

async function handleUpdate(request: NextRequest) {
  const auth = await requireOfficeOwnerAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = await parseIdentityPayload(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  try {
    const settings = await updateMobileOfficeSettings(auth.context, parsed.data);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const resolved = resolveSettingsError(error);
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
}

export async function PATCH(request: NextRequest) {
  return handleUpdate(request);
}

export async function POST(request: NextRequest) {
  return handleUpdate(request);
}
