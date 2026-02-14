import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

type VariableDef = {
  key: string;
  label_ar: string;
  required: boolean;
  source: 'client' | 'matter' | 'manual';
};

type ManifestEntry = {
  name: string;
  category: string;
  template_type: 'docx' | 'pdf';
  file: string;
  variables?: VariableDef[];
};

async function main() {
  const orgId = process.env.ORG_ID?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!orgId) {
    throw new Error('Missing ORG_ID (uuid).');
  }
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: ownerMembership, error: ownerError } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'owner')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownerError) {
    throw new Error(`Failed to load org owner: ${ownerError.message}`);
  }
  if (!ownerMembership?.user_id) {
    throw new Error('No owner membership found for this org.');
  }

  const ownerId = String(ownerMembership.user_id);

  const manifestPath = path.join(process.cwd(), 'seed', 'templates', 'manifest.json');
  const manifestRaw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw) as ManifestEntry[];

  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error('Starter templates manifest is empty.');
  }

  console.log(`Seeding ${manifest.length} starter templates into org ${orgId}...`);

  for (const entry of manifest) {
    const name = String(entry.name || '').trim();
    const category = String(entry.category || 'عام').trim() || 'عام';
    const templateType = entry.template_type === 'pdf' ? 'pdf' : 'docx';
    const fileName = String(entry.file || '').trim();

    if (!name || !fileName) {
      console.warn('Skipping invalid entry (missing name/file).');
      continue;
    }

    const { data: existing, error: existingError } = await supabase
      .from('templates')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', name)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed checking existing template "${name}": ${existingError.message}`);
    }

    if (existing?.id) {
      console.log(`- Skip: "${name}" (already exists)`);
      continue;
    }

    const { data: created, error: createError } = await supabase
      .from('templates')
      .insert({
        org_id: orgId,
        name,
        category,
        template_type: templateType,
        description: 'Starter template (placeholders only).',
        status: 'active',
        created_by: ownerId,
      })
      .select('id')
      .single();

    if (createError || !created?.id) {
      throw new Error(`Failed creating template "${name}": ${createError?.message ?? 'unknown'}`);
    }

    const templateId = String(created.id);
    const safeFileName = toSafeFileName(fileName);
    const storagePath = `org/${orgId}/tpl/${templateId}/v1/${safeFileName}`;
    const fullPath = path.join(process.cwd(), 'seed', 'templates', fileName);

    const buffer = await readFile(fullPath);

    const { error: uploadError } = await supabase.storage.from('templates').upload(storagePath, buffer, {
      contentType:
        templateType === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf',
      upsert: false,
    });

    if (uploadError) {
      throw new Error(`Failed uploading file for "${name}": ${uploadError.message}`);
    }

    const variables = Array.isArray(entry.variables) ? entry.variables : [];

    const { error: versionError } = await supabase.from('template_versions').insert({
      org_id: orgId,
      template_id: templateId,
      version_no: 1,
      storage_path: storagePath,
      file_name: safeFileName,
      file_size: buffer.byteLength,
      mime_type:
        templateType === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf',
      variables,
      uploaded_by: ownerId,
    });

    if (versionError) {
      throw new Error(`Failed creating version for "${name}": ${versionError.message}`);
    }

    console.log(`+ Seeded: "${name}" -> ${templateId}`);
  }

  console.log('Done.');
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

