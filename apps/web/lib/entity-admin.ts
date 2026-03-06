import 'server-only';

import { logWarn } from '@/lib/logger';
import { requireOwner } from '@/lib/org';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type CascadeRpcName =
  | 'delete_client_cascade'
  | 'delete_document_cascade'
  | 'delete_invoice_cascade'
  | 'delete_matter_cascade'
  | 'delete_task_cascade';

type CascadeResult = {
  storage_paths?: string[] | null;
};

export async function runCascadeDelete(
  rpcName: CascadeRpcName,
  entityParams: Record<string, string>,
) {
  const { orgId, userId } = await requireOwner();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc(rpcName, {
    p_org_id: orgId,
    p_actor_id: userId,
    ...entityParams,
  });

  if (error) {
    const message = String(error.message ?? '').toLowerCase();
    if (message.includes('not_found')) {
      throw new Error('not_found');
    }
    if (message.includes('not_allowed')) {
      throw new Error('لا تملك صلاحية لهذا الإجراء.');
    }
    throw error;
  }

  const storagePaths = normalizeStoragePaths(data as CascadeResult | null);
  if (storagePaths.length) {
    await removeDocumentStorageObjects(storagePaths);
  }

  return { success: true };
}

async function removeDocumentStorageObjects(storagePaths: string[]) {
  const uniquePaths = Array.from(new Set(storagePaths.filter(Boolean)));
  if (!uniquePaths.length) {
    return;
  }

  const supabase = createSupabaseServerClient();

  for (let index = 0; index < uniquePaths.length; index += 100) {
    const batch = uniquePaths.slice(index, index + 100);
    const { error } = await supabase.storage.from('documents').remove(batch);
    if (error) {
      logWarn('document_storage_cleanup_failed', {
        count: batch.length,
        message: error.message,
      });
    }
  }
}

function normalizeStoragePaths(result: CascadeResult | null): string[] {
  if (!result?.storage_paths || !Array.isArray(result.storage_paths)) {
    return [];
  }

  return result.storage_paths
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}
