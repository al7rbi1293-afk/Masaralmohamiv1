'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { writeAuditLog } from '@/lib/audit';

const clientSchema = z.object({
  type: z.enum(['person', 'company']).default('person'),
  name: z.string().trim().min(1, 'يرجى إدخال اسم العميل.').max(200, 'الاسم طويل جدًا.'),
  identity_no: z.string().trim().max(60, 'رقم الهوية طويل جدًا.').optional(),
  commercial_no: z.string().trim().max(60, 'السجل التجاري طويل جدًا.').optional(),
  email: z.string().trim().email('يرجى إدخال بريد صحيح.').max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(40, 'رقم الجوال طويل جدًا.').optional().or(z.literal('')),
  notes: z.string().trim().max(2000, 'الملاحظات طويلة جدًا.').optional().or(z.literal('')),
  status: z.enum(['active', 'archived']).default('active'),
});

function toText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function createClientAction(formData: FormData) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    redirect('/app');
  }

  const parsed = clientSchema.safeParse({
    type: toText(formData, 'type'),
    name: toText(formData, 'name'),
    identity_no: toText(formData, 'identity_no'),
    commercial_no: toText(formData, 'commercial_no'),
    email: toText(formData, 'email'),
    phone: toText(formData, 'phone'),
    notes: toText(formData, 'notes'),
    status: toText(formData, 'status'),
  });

  if (!parsed.success) {
    redirect(`/app/clients/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.')}`);
  }

  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('clients')
    .insert({
      org_id: orgId,
      type: parsed.data.type,
      name: parsed.data.name,
      identity_no: emptyToNull(parsed.data.identity_no),
      commercial_no: emptyToNull(parsed.data.commercial_no),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      notes: emptyToNull(parsed.data.notes),
      status: parsed.data.status,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    redirect(`/app/clients/new?error=${encodeURIComponent('تعذر إنشاء العميل. حاول مرة أخرى.')}`);
  }

  await writeAuditLog({
    action: 'client_created',
    entityType: 'client',
    entityId: data.id,
  });

  redirect(`/app/clients/${data.id}`);
}

export async function updateClientAction(clientId: string, formData: FormData) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    redirect('/app');
  }

  const parsed = clientSchema.safeParse({
    type: toText(formData, 'type'),
    name: toText(formData, 'name'),
    identity_no: toText(formData, 'identity_no'),
    commercial_no: toText(formData, 'commercial_no'),
    email: toText(formData, 'email'),
    phone: toText(formData, 'phone'),
    notes: toText(formData, 'notes'),
    status: toText(formData, 'status'),
  });

  if (!parsed.success) {
    redirect(`/app/clients/${clientId}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.')}`);
  }

  const supabase = createSupabaseServerRlsClient();
  const { error } = await supabase
    .from('clients')
    .update({
      type: parsed.data.type,
      name: parsed.data.name,
      identity_no: emptyToNull(parsed.data.identity_no),
      commercial_no: emptyToNull(parsed.data.commercial_no),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      notes: emptyToNull(parsed.data.notes),
      status: parsed.data.status,
    })
    .eq('id', clientId)
    .eq('org_id', orgId);

  if (error) {
    redirect(`/app/clients/${clientId}?error=${encodeURIComponent('تعذر تحديث العميل. حاول مرة أخرى.')}`);
  }

  await writeAuditLog({
    action: 'client_updated',
    entityType: 'client',
    entityId: clientId,
  });

  redirect(`/app/clients/${clientId}?success=1`);
}

export async function archiveClientAction(clientId: string) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    redirect('/app');
  }

  const supabase = createSupabaseServerRlsClient();
  const { error } = await supabase
    .from('clients')
    .update({ status: 'archived' })
    .eq('id', clientId)
    .eq('org_id', orgId);

  if (error) {
    redirect(`/app/clients/${clientId}?error=${encodeURIComponent('تعذر أرشفة العميل.')}`);
  }

  await writeAuditLog({
    action: 'client_archived',
    entityType: 'client',
    entityId: clientId,
  });

  redirect(`/app/clients/${clientId}?success=1`);
}

export async function unarchiveClientAction(clientId: string) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    redirect('/app');
  }

  const supabase = createSupabaseServerRlsClient();
  const { error } = await supabase
    .from('clients')
    .update({ status: 'active' })
    .eq('id', clientId)
    .eq('org_id', orgId);

  if (error) {
    redirect(`/app/clients/${clientId}?error=${encodeURIComponent('تعذر استعادة العميل.')}`);
  }

  await writeAuditLog({
    action: 'client_unarchived',
    entityType: 'client',
    entityId: clientId,
  });

  redirect(`/app/clients/${clientId}?success=1`);
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

