import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { buildDocx, buildPdf, type DocParams } from '@/lib/doc-engine';
import { TEMPLATE_PRESETS } from '@/lib/templatePresets';

const exportSchema = z.object({
    generation_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
    const user = await getCurrentAuthUser();
    if (!user) {
        return NextResponse.json({ message: 'يرجى تسجيل الدخول.' }, { status: 401 });
    }

    let orgId: string;
    try {
        orgId = await requireOrgIdForUser();
    } catch {
        return NextResponse.json({ message: 'لا يوجد مكتب مفعّل.' }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ message: 'بيانات غير صالحة.' }, { status: 400 });
    }

    const parsed = exportSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ message: 'معرّف المسودة مطلوب.' }, { status: 400 });
    }

    const supabase = createSupabaseServerRlsClient();

    // Fetch the generation (RLS scoped)
    const { data: gen, error: fetchError } = await supabase
        .from('doc_generations')
        .select('*')
        .eq('id', parsed.data.generation_id)
        .eq('org_id', orgId)
        .single();

    if (fetchError || !gen) {
        return NextResponse.json({ message: 'المسودة غير موجودة.' }, { status: 404 });
    }

    // Get org name
    const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();

    // Find preset
    const preset = TEMPLATE_PRESETS.find((p) => p.code === gen.preset_code);
    const presetNameAr = preset?.name_ar ?? gen.preset_code;

    // Build fields list from variables + preset schema
    const variables = (gen.variables ?? {}) as Record<string, string>;
    const fields = preset
        ? preset.variables.map((v) => ({
            label: v.label_ar,
            value: variables[v.key] ?? '',
        }))
        : Object.entries(variables).map(([key, value]) => ({
            label: key,
            value: String(value),
        }));

    const docParams: DocParams = {
        orgName: org?.name ?? 'مكتب محاماة',
        title: gen.title,
        presetNameAr,
        date: new Date().toLocaleDateString('ar-SA'),
        fields,
    };

    let buffer: Buffer;
    let contentType: string;
    let ext: string;

    try {
        if (gen.format === 'docx') {
            buffer = await buildDocx(docParams);
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            ext = 'docx';
        } else {
            buffer = await buildPdf(docParams);
            contentType = 'application/pdf';
            ext = 'pdf';
        }
    } catch (err) {
        // Mark generation as failed
        await supabase
            .from('doc_generations')
            .update({ status: 'failed' })
            .eq('id', gen.id);

        return NextResponse.json(
            { message: 'فشل إنشاء الملف.' },
            { status: 500 },
        );
    }

    // Upload to Supabase Storage
    const storagePath = `${orgId}/${gen.matter_id ?? 'general'}/${gen.id}.${ext}`;
    const adminClient = createSupabaseServerClient();

    const { error: uploadError } = await adminClient.storage
        .from('documents')
        .upload(storagePath, buffer, {
            contentType,
            upsert: true,
        });

    if (uploadError) {
        await supabase
            .from('doc_generations')
            .update({ status: 'failed' })
            .eq('id', gen.id);

        return NextResponse.json(
            { message: 'فشل رفع الملف إلى التخزين.' },
            { status: 500 },
        );
    }

    // Update generation record
    await supabase
        .from('doc_generations')
        .update({ status: 'exported', file_path: storagePath })
        .eq('id', gen.id);

    return NextResponse.json({
        success: true,
        file_path: storagePath,
        format: gen.format,
        generation_id: gen.id,
    });
}
