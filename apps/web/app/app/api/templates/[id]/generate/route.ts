import { NextResponse } from 'next/server';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { logAudit } from '@/lib/audit';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { CircuitOpenError, TimeoutError, withCircuitBreaker, withTimeout } from '@/lib/runtime-safety';

export const runtime = 'nodejs';

const generateSchema = z.object({
  matter_id: z.string().uuid().optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  client_id: z.string().uuid().optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  values: z.record(z.string(), z.string().max(5000, 'قيمة المتغير طويلة جدًا.')).optional().default({}),
  output_title: z.string().trim().max(200, 'عنوان المستند طويل جدًا.').optional().or(z.literal('')),
});

type RouteContext = {
  params: { id: string };
};

export async function POST(request: Request, context: RouteContext) {
  const templateId = String(context.params.id || '').trim();
  if (!templateId) {
    return NextResponse.json({ error: 'القالب غير موجود.' }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر إنشاء المستند من القالب.' },
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
      .select('id, org_id, name, template_type')
      .eq('org_id', orgId)
      .eq('id', templateId)
      .maybeSingle();

    if (templateError) {
      logError('template_generate_fetch_failed', { message: templateError.message });
      return NextResponse.json({ error: 'تعذر إنشاء المستند من القالب.' }, { status: 400 });
    }

    if (!template) {
      return NextResponse.json({ error: 'القالب غير موجود أو لا تملك صلاحية الوصول.' }, { status: 404 });
    }

    if (template.template_type !== 'docx') {
      return NextResponse.json(
        { error: 'حاليًا يدعم إنشاء المستندات من قوالب DOCX فقط.' },
        { status: 400 },
      );
    }

    const { data: latestVersion, error: versionError } = await rls
      .from('template_versions')
      .select('id, storage_path, file_name, version_no, variables')
      .eq('org_id', orgId)
      .eq('template_id', templateId)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      logError('template_generate_version_fetch_failed', { message: versionError.message });
      return NextResponse.json({ error: 'تعذر إنشاء المستند من القالب.' }, { status: 400 });
    }

    if (!latestVersion) {
      return NextResponse.json({ error: 'لا توجد نسخة مرفوعة لهذا القالب.' }, { status: 400 });
    }

    const matter = parsed.data.matter_id
      ? await fetchMatter(rls, orgId, parsed.data.matter_id).catch(() => null)
      : null;

    if (parsed.data.matter_id && !matter) {
      return NextResponse.json(
        { error: 'القضية غير موجودة أو لا تملك صلاحية الوصول.' },
        { status: 404 },
      );
    }

    const effectiveClientId = matter?.client_id ?? parsed.data.client_id ?? null;
    const resolvedClient = effectiveClientId
      ? await fetchClient(rls, orgId, effectiveClientId).catch(() => null)
      : null;

    if (effectiveClientId && !resolvedClient) {
      return NextResponse.json({ error: 'الموكل غير موجود أو لا تملك صلاحية الوصول.' }, { status: 404 });
    }

    const templateBuffer = await downloadTemplateFile(latestVersion.storage_path);

    const contextData = buildContext({
      templateName: String(template.name ?? ''),
      matter,
      client: resolvedClient,
      values: parsed.data.values ?? {},
    });

    const generated = renderDocx(templateBuffer, contextData);

    const documentId = crypto.randomUUID();
    const title = (parsed.data.output_title?.trim() || String(template.name ?? '').trim() || 'مستند').slice(0, 200);

    const { data: createdDoc, error: docError } = await rls
      .from('documents')
      .insert({
        id: documentId,
        org_id: orgId,
        title,
        description: `مستند مولّد من قالب: ${template.name ?? ''}`.trim(),
        matter_id: matter?.id ?? parsed.data.matter_id ?? null,
        client_id: resolvedClient?.id ?? parsed.data.client_id ?? null,
      })
      .select('id')
      .single();

    if (docError || !createdDoc) {
      logError('template_generate_document_insert_failed', { message: docError?.message ?? 'unknown' });
      return NextResponse.json({ error: toUserMessage(docError) }, { status: statusForError(docError) });
    }

    const outputFileName = toSafeFileName(`${title}.docx`);
    const storagePath = `org/${orgId}/doc/${documentId}/v1/${outputFileName}`;

    await uploadGeneratedDocx(storagePath, generated, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const { data: versionRow, error: versionInsertError } = await rls
      .from('document_versions')
      .insert({
        org_id: orgId,
        document_id: documentId,
        version_no: 1,
        storage_path: storagePath,
        file_name: outputFileName,
        file_size: generated.byteLength,
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        checksum: null,
        uploaded_by: user.id,
      })
      .select('id')
      .single();

    if (versionInsertError || !versionRow) {
      logError('template_generate_doc_version_insert_failed', { message: versionInsertError?.message ?? 'unknown' });
      return NextResponse.json({ error: toUserMessage(versionInsertError) }, { status: statusForError(versionInsertError) });
    }

    await rls.from('template_runs').insert({
      org_id: orgId,
      template_id: templateId,
      matter_id: matter?.id ?? null,
      client_id: resolvedClient?.id ?? null,
      status: 'completed',
      output_document_id: documentId,
      error: null,
      created_by: user.id,
    });

    await logAudit({
      action: 'template.generated',
      entityType: 'template',
      entityId: templateId,
      meta: { document_id: documentId },
      req: request,
    });

    logInfo('template_generated', { templateId, documentId });

    return NextResponse.json({ document_id: documentId }, { status: 200 });
  } catch (error) {
    logError('template_generate_failed', { message: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'تعذر إنشاء المستند من القالب.' }, { status: 500 });
  }
}

type ClientRow = {
  id: string;
  type: string;
  name: string;
  identity_no: string | null;
  commercial_no: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

type MatterRow = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  summary: string | null;
  assigned_user_id: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
};

async function fetchMatter(rls: ReturnType<typeof createSupabaseServerRlsClient>, orgId: string, matterId: string) {
  const { data, error } = await rls
    .from('matters')
    .select('id, client_id, title, status, summary, assigned_user_id, is_private, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('id', matterId)
    .maybeSingle();

  if (error) throw error;
  return (data as MatterRow | null) ?? null;
}

async function fetchClient(rls: ReturnType<typeof createSupabaseServerRlsClient>, orgId: string, clientId: string) {
  const { data, error } = await rls
    .from('clients')
    .select('id, type, name, identity_no, commercial_no, email, phone, notes')
    .eq('org_id', orgId)
    .eq('id', clientId)
    .maybeSingle();

  if (error) throw error;
  return (data as ClientRow | null) ?? null;
}

async function downloadTemplateFile(storagePath: string): Promise<Buffer> {
  const service = createSupabaseServerClient();

  let signedUrl: string | null = null;
  let signError: { message?: string } | null = null;

  try {
    const result = (await withCircuitBreaker(
      'storage.templates.download_for_generate',
      { failureThreshold: 3, cooldownMs: 30_000 },
      () => withTimeout(service.storage.from('templates').createSignedUrl(storagePath, 300), 8_000),
    )) as { data: { signedUrl: string } | null; error: { message?: string } | null };

    signedUrl = result.data?.signedUrl ?? null;
    signError = result.error;
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
      logWarn('template_generate_template_download_transient', { message: error.message });
      throw new Error('transient_download');
    }
    throw error;
  }

  if (signError || !signedUrl) {
    throw new Error('template_download_sign_failed');
  }

  const response = await withTimeout(fetch(signedUrl), 10_000);
  if (!response.ok) {
    throw new Error('template_download_failed');
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function renderDocx(templateBuffer: Buffer, contextData: Record<string, unknown>): Buffer {
  try {
    const zip = new (PizZip as any)(templateBuffer);
    const doc = new (Docxtemplater as any)(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    doc.render(contextData);
    return doc.getZip().generate({ type: 'nodebuffer' });
  } catch (error) {
    logError('template_generate_render_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    throw new Error('render_failed');
  }
}

function buildContext(params: {
  templateName: string;
  matter: MatterRow | null;
  client: ClientRow | null;
  values: Record<string, string>;
}) {
  const ctx: Record<string, any> = {};

  ctx.template = { name: params.templateName };
  ctx.date = {
    today: new Date().toLocaleDateString('ar-SA'),
    iso: new Date().toISOString(),
  };

  if (params.matter) {
    ctx.matter = {
      id: params.matter.id,
      title: params.matter.title,
      status: params.matter.status,
      summary: params.matter.summary ?? '',
      assigned_user_id: params.matter.assigned_user_id,
      is_private: params.matter.is_private,
      created_at: params.matter.created_at,
      updated_at: params.matter.updated_at,
    };
  }

  if (params.client) {
    ctx.client = {
      id: params.client.id,
      type: params.client.type,
      name: params.client.name,
      identity_no: params.client.identity_no ?? '',
      commercial_no: params.client.commercial_no ?? '',
      email: params.client.email ?? '',
      phone: params.client.phone ?? '',
      notes: params.client.notes ?? '',
    };
  }

  // Manual values override any derived context.
  for (const [key, value] of Object.entries(params.values || {})) {
    const safeKey = String(key || '').trim().slice(0, 160);
    if (!safeKey) continue;
    setNested(ctx, safeKey, String(value ?? ''));
  }

  return ctx;
}

function setNested(target: Record<string, any>, path: string, value: unknown) {
  const parts = path.split('.').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return;

  let cursor: any = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!cursor[part] || typeof cursor[part] !== 'object') {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

async function uploadGeneratedDocx(
  storagePath: string,
  buffer: Buffer,
  opts: { contentType: string },
) {
  const service = createSupabaseServerClient();

  let signed: { signedUrl: string; token: string } | null = null;
  let signError: { message?: string } | null = null;

  try {
    const result = (await withCircuitBreaker(
      'storage.documents.upload_generated_docx',
      { failureThreshold: 3, cooldownMs: 30_000 },
      () =>
        withTimeout(service.storage.from('documents').createSignedUploadUrl(storagePath), 8_000),
    )) as { data: { signedUrl: string; token: string } | null; error: { message?: string } | null };

    signed = result.data;
    signError = result.error;
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
      logWarn('template_generate_upload_transient', { message: error.message });
      throw error;
    }
    throw error;
  }

  if (signError || !signed?.signedUrl) {
    throw new Error('upload_sign_failed');
  }

  const putResponse = await withTimeout(
    fetch(signed.signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': opts.contentType,
      },
      // Node fetch accepts Buffer/Uint8Array bodies; cast avoids TS lib mismatch (Node typed arrays are generic).
      body: buffer as any,
    }),
    15_000,
  );

  if (!putResponse.ok) {
    throw new Error('upload_failed');
  }
}

function toSafeFileName(value: string) {
  const cleaned = value
    .replaceAll('\\', '_')
    .replaceAll('/', '_')
    .replaceAll('\u0000', '')
    .trim();

  const parts = cleaned.split('.').filter(Boolean);
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';
  const base = parts.length > 1 ? parts.slice(0, -1).join('.') : cleaned;

  const safeBase =
    base
      .replace(/[^A-Za-z0-9 _-]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'file';

  const safeExt = ext.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
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

function toUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security')
  ) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }

  return 'تعذر إنشاء المستند من القالب.';
}
