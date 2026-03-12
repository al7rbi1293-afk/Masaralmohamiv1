import 'dotenv/config';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type AppUserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  phone: string | null;
  status: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  email_verification_token: string | null;
  email_verification_expires_at: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
  created_at: string;
  status: string | null;
  logo_url: string | null;
};

type MembershipRow = {
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

type TrialRow = {
  org_id: string;
  started_at: string;
  ends_at: string;
  status: string;
  updated_at: string;
};

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function getEnvVar(name: string, fallback?: string) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

async function tableExists(client: SupabaseClient, table: string) {
  const { error } = await client.from(table).select('*', { head: true, count: 'exact' });
  if (!error) return true;
  return !/Could not find the table|relation .* does not exist|PGRST/i.test(error.message);
}

async function readAll<T>(client: SupabaseClient, table: string, columns: string) {
  const { data, error } = await client.from(table).select(columns);
  if (error) {
    throw new Error(`Failed reading ${table}: ${error.message}`);
  }

  return (data || []) as T[];
}

async function insertInBatches<T extends object>(client: SupabaseClient, table: string, rows: T[]) {
  for (const batch of chunk(rows, 200)) {
    const { error } = await client.from(table).insert(batch);
    if (error) {
      throw new Error(`Failed inserting into ${table}: ${error.message}`);
    }
  }
}

async function run() {
  const apply = process.argv.includes('--apply');

  const oldUrl = getEnvVar('OLD_SUPABASE_URL');
  const oldServiceRole = getEnvVar('OLD_SUPABASE_SERVICE_ROLE_KEY');
  const newUrl = getEnvVar('NEW_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  const newServiceRole = getEnvVar('NEW_SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

  const oldDb = createClient(oldUrl, oldServiceRole, { auth: { persistSession: false } });
  const newDb = createClient(newUrl, newServiceRole, { auth: { persistSession: false } });

  const requiredTables = ['app_users', 'organizations', 'memberships', 'trial_subscriptions'];
  for (const table of requiredTables) {
    const exists = await tableExists(oldDb, table);
    if (!exists) {
      throw new Error(
        `Old project does not contain required table "${table}". ` +
          'This source is likely not the legacy Masar database.',
      );
    }
  }

  const oldUsers = await readAll<AppUserRow>(
    oldDb,
    'app_users',
    'id,email,password_hash,full_name,phone,status,email_verified,created_at,updated_at,email_verification_token,email_verification_expires_at',
  );
  const oldOrganizations = await readAll<OrganizationRow>(
    oldDb,
    'organizations',
    'id,name,created_at,status,logo_url',
  );
  const oldMemberships = await readAll<MembershipRow>(
    oldDb,
    'memberships',
    'org_id,user_id,role,created_at',
  );
  const oldTrials = await readAll<TrialRow>(
    oldDb,
    'trial_subscriptions',
    'org_id,started_at,ends_at,status,updated_at',
  );

  const currentUsers = await readAll<Pick<AppUserRow, 'id' | 'email'>>(newDb, 'app_users', 'id,email');
  const currentOrganizations = await readAll<Pick<OrganizationRow, 'id' | 'name'>>(
    newDb,
    'organizations',
    'id,name',
  );
  const currentMemberships = await readAll<Pick<MembershipRow, 'org_id' | 'user_id'>>(
    newDb,
    'memberships',
    'org_id,user_id',
  );
  const currentTrials = await readAll<Pick<TrialRow, 'org_id'>>(newDb, 'trial_subscriptions', 'org_id');

  const userIdMap = new Map<string, string>();
  const usersByEmail = new Map(currentUsers.map((u) => [u.email.toLowerCase(), u.id]));
  const orgIdMap = new Map<string, string>();
  const orgById = new Set(currentOrganizations.map((o) => o.id));
  const membershipSet = new Set(currentMemberships.map((m) => `${m.org_id}:${m.user_id}`));
  const trialOrgSet = new Set(currentTrials.map((t) => t.org_id));

  const usersToInsert: AppUserRow[] = [];
  let reusedUsers = 0;
  for (const oldUser of oldUsers) {
    const key = oldUser.email.trim().toLowerCase();
    const existingId = usersByEmail.get(key);
    if (existingId) {
      userIdMap.set(oldUser.id, existingId);
      reusedUsers += 1;
      continue;
    }

    usersToInsert.push(oldUser);
    userIdMap.set(oldUser.id, oldUser.id);
  }

  const orgsToInsert: OrganizationRow[] = [];
  let reusedOrgsById = 0;
  for (const oldOrg of oldOrganizations) {
    // IMPORTANT: never merge organizations by name.
    // Different customers can legitimately choose the same office name.
    // We only reuse organization by exact id match.
    if (orgById.has(oldOrg.id)) {
      orgIdMap.set(oldOrg.id, oldOrg.id);
      reusedOrgsById += 1;
      continue;
    }

    orgsToInsert.push(oldOrg);
    orgIdMap.set(oldOrg.id, oldOrg.id);
  }

  const membershipsToInsert: MembershipRow[] = [];
  for (const oldMembership of oldMemberships) {
    const mappedUser = userIdMap.get(oldMembership.user_id);
    const mappedOrg = orgIdMap.get(oldMembership.org_id);
    if (!mappedUser || !mappedOrg) {
      continue;
    }

    const key = `${mappedOrg}:${mappedUser}`;
    if (membershipSet.has(key)) {
      continue;
    }

    membershipsToInsert.push({
      org_id: mappedOrg,
      user_id: mappedUser,
      role: oldMembership.role,
      created_at: oldMembership.created_at,
    });
    membershipSet.add(key);
  }

  const trialsToUpsert: TrialRow[] = [];
  for (const oldTrial of oldTrials) {
    const mappedOrg = orgIdMap.get(oldTrial.org_id);
    if (!mappedOrg || trialOrgSet.has(mappedOrg)) {
      continue;
    }

    trialsToUpsert.push({
      org_id: mappedOrg,
      started_at: oldTrial.started_at,
      ends_at: oldTrial.ends_at,
      status: oldTrial.status,
      updated_at: oldTrial.updated_at,
    });
    trialOrgSet.add(mappedOrg);
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        old_counts: {
          app_users: oldUsers.length,
          organizations: oldOrganizations.length,
          memberships: oldMemberships.length,
          trial_subscriptions: oldTrials.length,
        },
        plan: {
          users_to_insert: usersToInsert.length,
          users_reused_by_email: reusedUsers,
          organizations_to_insert: orgsToInsert.length,
          organizations_reused_by_id: reusedOrgsById,
          memberships_to_insert: membershipsToInsert.length,
          trials_to_upsert: trialsToUpsert.length,
        },
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log('Dry run complete. Re-run with --apply to execute migration.');
    return;
  }

  if (usersToInsert.length > 0) {
    await insertInBatches(newDb, 'app_users', usersToInsert);
  }

  if (orgsToInsert.length > 0) {
    await insertInBatches(newDb, 'organizations', orgsToInsert);
  }

  if (membershipsToInsert.length > 0) {
    await insertInBatches(newDb, 'memberships', membershipsToInsert);
  }

  if (trialsToUpsert.length > 0) {
    for (const batch of chunk(trialsToUpsert, 200)) {
      const { error } = await newDb.from('trial_subscriptions').upsert(batch, { onConflict: 'org_id' });
      if (error) {
        throw new Error(`Failed upserting trial_subscriptions: ${error.message}`);
      }
    }
  }

  console.log('Migration completed successfully.');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unexpected migration error');
  process.exit(1);
});
