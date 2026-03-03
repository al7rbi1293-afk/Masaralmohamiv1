import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function signRlsJwt(secret: string, userId: string) {
  return new SignJWT({ role: 'authenticated', aud: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(secret));
}

function makeRlsClient(url: string, anon: string, token: string) {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function main() {
  if (process.env.RLS_SMOKE_TEST_RUN?.trim() !== '1') {
    throw new Error('Set RLS_SMOKE_TEST_RUN=1 to run this test');
  }

  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const anon = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceRole = required('SUPABASE_SERVICE_ROLE_KEY');
  const jwtSecret = required('SUPABASE_JWT_SECRET');

  const service = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ownerId = crypto.randomUUID();
  const assigneeId = crypto.randomUUID();
  const outsiderId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  const caseId = crypto.randomUUID();

  const emailSuffix = crypto.randomUUID().slice(0, 8);

  try {
    await service.from('app_users').insert([
      { id: ownerId, email: `owner-${emailSuffix}@example.test`, password_hash: 'x', full_name: 'Owner' },
      { id: assigneeId, email: `assignee-${emailSuffix}@example.test`, password_hash: 'x', full_name: 'Assignee' },
      { id: outsiderId, email: `outsider-${emailSuffix}@example.test`, password_hash: 'x', full_name: 'Outsider' },
    ]);

    await service.from('organizations').insert({ id: orgId, name: `RLS Org ${emailSuffix}` });

    await service.from('memberships').insert([
      { org_id: orgId, user_id: ownerId, role: 'owner' },
      { org_id: orgId, user_id: assigneeId, role: 'lawyer' },
      { org_id: orgId, user_id: outsiderId, role: 'assistant' },
    ]);

    await service.from('clients').insert({
      id: clientId,
      org_id: orgId,
      type: 'person',
      name: 'RLS Client',
      status: 'active',
    });

    await service.from('matters').insert({
      id: caseId,
      org_id: orgId,
      client_id: clientId,
      title: 'RLS Restricted Case',
      status: 'new',
      is_private: true,
      assigned_user_id: assigneeId,
    });

    await service.from('matter_members').insert({
      matter_id: caseId,
      user_id: assigneeId,
    });

    const caseDocumentId = crypto.randomUUID();
    await service.from('case_documents').insert({
      id: caseDocumentId,
      org_id: orgId,
      case_id: caseId,
      title: 'RLS Document',
      file_name: 'rls.pdf',
      storage_bucket: 'documents',
      storage_path: `${orgId}/${caseDocumentId}.pdf`,
      sha256: crypto.createHash('sha256').update('rls').digest('hex'),
      status: 'ready',
    });

    const ownerToken = await signRlsJwt(jwtSecret, ownerId);
    const assigneeToken = await signRlsJwt(jwtSecret, assigneeId);
    const outsiderToken = await signRlsJwt(jwtSecret, outsiderId);

    const ownerClient = makeRlsClient(url, anon, ownerToken);
    const assigneeClient = makeRlsClient(url, anon, assigneeToken);
    const outsiderClient = makeRlsClient(url, anon, outsiderToken);

    const ownerRead = await ownerClient.from('case_documents').select('id').eq('id', caseDocumentId).maybeSingle();
    const assigneeRead = await assigneeClient
      .from('case_documents')
      .select('id')
      .eq('id', caseDocumentId)
      .maybeSingle();
    const outsiderRead = await outsiderClient
      .from('case_documents')
      .select('id')
      .eq('id', caseDocumentId)
      .maybeSingle();

    assert(ownerRead.data?.id, 'Owner should access restricted case documents.');
    assert(assigneeRead.data?.id, 'Assigned member should access restricted case documents.');
    assert(!outsiderRead.data, 'Unassigned member must be blocked from restricted case documents.');

    console.log('copilot_rls_smoke_test: PASS');
  } finally {
    await service.from('organizations').delete().eq('id', orgId).catch(() => undefined);
    await service.from('app_users').delete().in('id', [ownerId, assigneeId, outsiderId]).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('copilot_rls_smoke_test: FAIL', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
