/**
 * RLS / AuthZ Smoke Test (Phase 9.1.1)
 *
 * Runs a minimal end-to-end check against Supabase:
 * - Creates 2 users + 2 orgs (service role)
 * - Seeds sample rows in each org
 * - Verifies cross-org reads are blocked by RLS
 * - Verifies private matters (and linked docs/tasks) are visible only to owner/members
 *
 * Safety:
 * - Requires `RLS_SMOKE_TEST_RUN=1` to run.
 * - Never prints emails/passwords/tokens.
 *
 * Usage:
 *   RLS_SMOKE_TEST_RUN=1 \
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm run test:rls
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

type Env = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

type UserRec = {
  id: string;
  password: string;
};

type OrgRec = {
  id: string;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createServiceClient(env: Env) {
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createRlsClient(env: Env, accessToken: string) {
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function createUser(
  service: SupabaseClient,
  email: string,
  password: string,
  fullName: string,
): Promise<UserRec> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message ?? 'unknown_error'}`);
  }

  return { id: data.user.id, password };
}

async function deleteUser(service: SupabaseClient, userId: string) {
  try {
    await service.auth.admin.deleteUser(userId);
  } catch {
    // best-effort
  }
}

async function createOrg(service: SupabaseClient, name: string): Promise<OrgRec> {
  const { data, error } = await service
    .from('organizations')
    .insert({ name })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`createOrg failed: ${error?.message ?? 'unknown_error'}`);
  }

  return { id: String((data as any).id) };
}

async function deleteOrg(service: SupabaseClient, orgId: string) {
  try {
    await service.from('organizations').delete().eq('id', orgId);
  } catch {
    // best-effort
  }
}

async function addMembership(
  service: SupabaseClient,
  orgId: string,
  userId: string,
  role: 'owner' | 'lawyer' | 'assistant',
) {
  const { error } = await service.from('memberships').insert({
    org_id: orgId,
    user_id: userId,
    role,
  });
  if (error) throw new Error(`addMembership failed: ${error.message}`);
}

async function signIn(env: Env, email: string, password: string) {
  const auth = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`signIn failed: ${error?.message ?? 'no_session'}`);
  }

  return {
    accessToken: data.session.access_token,
    userId: data.session.user.id,
  };
}

async function fetchMaybe(
  client: SupabaseClient,
  table: string,
  id: string,
): Promise<{ id: string } | null> {
  const { data, error } = await client.from(table).select('id').eq('id', id).maybeSingle();
  if (error) throw new Error(`query failed (${table}): ${error.message}`);
  return (data as any) ? { id: String((data as any).id) } : null;
}

async function assertCanRead(client: SupabaseClient, table: string, id: string) {
  const row = await fetchMaybe(client, table, id);
  assert(row, `Expected to read ${table}:${id} but got null`);
}

async function assertCannotRead(client: SupabaseClient, table: string, id: string) {
  const row = await fetchMaybe(client, table, id);
  assert(!row, `Expected NOT to read ${table}:${id} but got data`);
}

function randomEmail(prefix: string) {
  const id = crypto.randomUUID();
  return `${prefix}-${id}@example.test`;
}

function randomPassword() {
  // 18+ chars, includes symbols; never printed.
  return `T3st!${crypto.randomUUID()}Aa`;
}

async function main() {
  if (process.env.RLS_SMOKE_TEST_RUN?.trim() !== '1') {
    console.error('Refusing to run. Set RLS_SMOKE_TEST_RUN=1 to continue.');
    process.exit(1);
  }

  const env: Env = {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };

  const service = createServiceClient(env);

  const userAEmail = randomEmail('rls-user-a');
  const userBEmail = randomEmail('rls-user-b');
  const userAPass = randomPassword();
  const userBPass = randomPassword();

  let userA: UserRec | null = null;
  let userB: UserRec | null = null;
  let orgA: OrgRec | null = null;
  let orgB: OrgRec | null = null;

  try {
    userA = await createUser(service, userAEmail, userAPass, 'RLS User A');
    userB = await createUser(service, userBEmail, userBPass, 'RLS User B');

    orgA = await createOrg(service, 'RLS Org A');
    orgB = await createOrg(service, 'RLS Org B');

    await addMembership(service, orgA.id, userA.id, 'owner');
    await addMembership(service, orgB.id, userB.id, 'owner');

    // Seed minimal records in each org (service role bypasses RLS).
    const clientA = await service
      .from('clients')
      .insert({ org_id: orgA.id, type: 'person', name: 'عميل (A)', status: 'active' })
      .select('id')
      .single();
    assert(clientA.data?.id, 'Failed to create client A');

    const clientB = await service
      .from('clients')
      .insert({ org_id: orgB.id, type: 'person', name: 'عميل (B)', status: 'active' })
      .select('id')
      .single();
    assert(clientB.data?.id, 'Failed to create client B');

    const matterPublicA = await service
      .from('matters')
      .insert({
        org_id: orgA.id,
        client_id: String((clientA.data as any).id),
        title: 'قضية عامة (A)',
        status: 'new',
        is_private: false,
        assigned_user_id: userA.id,
      })
      .select('id')
      .single();
    assert(matterPublicA.data?.id, 'Failed to create matter public A');

    const matterPublicB = await service
      .from('matters')
      .insert({
        org_id: orgB.id,
        client_id: String((clientB.data as any).id),
        title: 'قضية عامة (B)',
        status: 'new',
        is_private: false,
        assigned_user_id: userB.id,
      })
      .select('id')
      .single();
    assert(matterPublicB.data?.id, 'Failed to create matter public B');

    const privateMatterA = await service
      .from('matters')
      .insert({
        org_id: orgA.id,
        client_id: String((clientA.data as any).id),
        title: 'قضية خاصة (A)',
        status: 'new',
        is_private: true,
        assigned_user_id: userA.id,
      })
      .select('id')
      .single();
    assert(privateMatterA.data?.id, 'Failed to create private matter A');

    await service.from('matter_members').insert({
      matter_id: String((privateMatterA.data as any).id),
      user_id: userA.id,
    });

    const docPublicA = await service
      .from('documents')
      .insert({
        org_id: orgA.id,
        matter_id: String((matterPublicA.data as any).id),
        client_id: String((clientA.data as any).id),
        title: 'مستند عام (A)',
      })
      .select('id')
      .single();
    assert(docPublicA.data?.id, 'Failed to create document public A');

    const docPrivateA = await service
      .from('documents')
      .insert({
        org_id: orgA.id,
        matter_id: String((privateMatterA.data as any).id),
        client_id: String((clientA.data as any).id),
        title: 'مستند خاص (A)',
      })
      .select('id')
      .single();
    assert(docPrivateA.data?.id, 'Failed to create document private A');

    const docB = await service
      .from('documents')
      .insert({
        org_id: orgB.id,
        matter_id: String((matterPublicB.data as any).id),
        client_id: String((clientB.data as any).id),
        title: 'مستند (B)',
      })
      .select('id')
      .single();
    assert(docB.data?.id, 'Failed to create document B');

    const taskPublicA = await service
      .from('tasks')
      .insert({
        org_id: orgA.id,
        matter_id: String((matterPublicA.data as any).id),
        title: 'مهمة عامة (A)',
        status: 'todo',
        priority: 'medium',
        created_by: userA.id,
        assignee_id: userA.id,
      })
      .select('id')
      .single();
    assert(taskPublicA.data?.id, 'Failed to create task public A');

    const taskPrivateA = await service
      .from('tasks')
      .insert({
        org_id: orgA.id,
        matter_id: String((privateMatterA.data as any).id),
        title: 'مهمة خاصة (A)',
        status: 'todo',
        priority: 'medium',
        created_by: userA.id,
        assignee_id: userA.id,
      })
      .select('id')
      .single();
    assert(taskPrivateA.data?.id, 'Failed to create task private A');

    const taskB = await service
      .from('tasks')
      .insert({
        org_id: orgB.id,
        matter_id: String((matterPublicB.data as any).id),
        title: 'مهمة (B)',
        status: 'todo',
        priority: 'medium',
        created_by: userB.id,
        assignee_id: userB.id,
      })
      .select('id')
      .single();
    assert(taskB.data?.id, 'Failed to create task B');

    const quoteA = await service
      .from('quotes')
      .insert({
        org_id: orgA.id,
        client_id: String((clientA.data as any).id),
        matter_id: String((matterPublicA.data as any).id),
        number: `Q-TEST-${crypto.randomUUID().slice(0, 8)}`,
        items: [{ desc: 'خدمة', qty: 1, unit_price: 100 }],
        total: 100,
        currency: 'SAR',
        status: 'draft',
        created_by: userA.id,
      })
      .select('id')
      .single();
    assert(quoteA.data?.id, 'Failed to create quote A');

    const invoiceA = await service
      .from('invoices')
      .insert({
        org_id: orgA.id,
        client_id: String((clientA.data as any).id),
        matter_id: String((matterPublicA.data as any).id),
        number: `INV-TEST-${crypto.randomUUID().slice(0, 8)}`,
        items: [{ desc: 'خدمة', qty: 1, unit_price: 200 }],
        subtotal: 200,
        tax: 0,
        total: 200,
        currency: 'SAR',
        status: 'unpaid',
        created_by: userA.id,
      })
      .select('id')
      .single();
    assert(invoiceA.data?.id, 'Failed to create invoice A');

    const paymentA = await service
      .from('payments')
      .insert({
        org_id: orgA.id,
        invoice_id: String((invoiceA.data as any).id),
        amount: 50,
        created_by: userA.id,
      })
      .select('id')
      .single();
    assert(paymentA.data?.id, 'Failed to create payment A');

    const invoiceB = await service
      .from('invoices')
      .insert({
        org_id: orgB.id,
        client_id: String((clientB.data as any).id),
        matter_id: String((matterPublicB.data as any).id),
        number: `INV-TEST-${crypto.randomUUID().slice(0, 8)}`,
        items: [{ desc: 'خدمة', qty: 1, unit_price: 300 }],
        subtotal: 300,
        tax: 0,
        total: 300,
        currency: 'SAR',
        status: 'unpaid',
        created_by: userB.id,
      })
      .select('id')
      .single();
    assert(invoiceB.data?.id, 'Failed to create invoice B');

    // Sign in and create RLS clients for reads.
    const sessionA = await signIn(env, userAEmail, userAPass);
    const sessionB = await signIn(env, userBEmail, userBPass);

    const rlsA = createRlsClient(env, sessionA.accessToken);
    const rlsB = createRlsClient(env, sessionB.accessToken);

    // Cross-org isolation (before userB is added to orgA).
    await assertCanRead(rlsA, 'clients', String((clientA.data as any).id));
    await assertCannotRead(rlsA, 'clients', String((clientB.data as any).id));
    await assertCannotRead(rlsB, 'clients', String((clientA.data as any).id));
    await assertCanRead(rlsB, 'clients', String((clientB.data as any).id));

    await assertCanRead(rlsA, 'matters', String((matterPublicA.data as any).id));
    await assertCannotRead(rlsA, 'matters', String((matterPublicB.data as any).id));
    await assertCannotRead(rlsB, 'matters', String((matterPublicA.data as any).id));
    await assertCanRead(rlsB, 'matters', String((matterPublicB.data as any).id));

    await assertCanRead(rlsA, 'documents', String((docPublicA.data as any).id));
    await assertCannotRead(rlsA, 'documents', String((docB.data as any).id));
    await assertCannotRead(rlsB, 'documents', String((docPublicA.data as any).id));
    await assertCanRead(rlsB, 'documents', String((docB.data as any).id));

    await assertCanRead(rlsA, 'tasks', String((taskPublicA.data as any).id));
    await assertCannotRead(rlsA, 'tasks', String((taskB.data as any).id));
    await assertCannotRead(rlsB, 'tasks', String((taskPublicA.data as any).id));
    await assertCanRead(rlsB, 'tasks', String((taskB.data as any).id));

    await assertCanRead(rlsA, 'quotes', String((quoteA.data as any).id));
    await assertCannotRead(rlsB, 'quotes', String((quoteA.data as any).id));

    await assertCanRead(rlsA, 'invoices', String((invoiceA.data as any).id));
    await assertCannotRead(rlsA, 'invoices', String((invoiceB.data as any).id));
    await assertCannotRead(rlsB, 'invoices', String((invoiceA.data as any).id));
    await assertCanRead(rlsB, 'invoices', String((invoiceB.data as any).id));

    await assertCanRead(rlsA, 'payments', String((paymentA.data as any).id));
    await assertCannotRead(rlsB, 'payments', String((paymentA.data as any).id));

    // Private matter rule inside same org:
    // Make userB a member of orgA but NOT a private matter member.
    await addMembership(service, orgA.id, userB.id, 'lawyer');

    // After becoming an org member, userB should read public orgA data…
    await assertCanRead(rlsB, 'clients', String((clientA.data as any).id));
    await assertCanRead(rlsB, 'matters', String((matterPublicA.data as any).id));

    // …but still cannot read private matter and its linked records.
    await assertCannotRead(rlsB, 'matters', String((privateMatterA.data as any).id));
    await assertCannotRead(rlsB, 'documents', String((docPrivateA.data as any).id));
    await assertCannotRead(rlsB, 'tasks', String((taskPrivateA.data as any).id));

    // Owner can read private matter.
    await assertCanRead(rlsA, 'matters', String((privateMatterA.data as any).id));

    console.log('[OK] RLS smoke test passed.');
  } finally {
    if (orgA) await deleteOrg(service, orgA.id);
    if (orgB) await deleteOrg(service, orgB.id);
    if (userA) await deleteUser(service, userA.id);
    if (userB) await deleteUser(service, userB.id);
  }
}

main().catch((error) => {
  console.error('[FAIL] RLS smoke test failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

