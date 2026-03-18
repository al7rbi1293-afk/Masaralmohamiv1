import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  MatterReference,
  NormalizedEnforcementRequest,
  NormalizedExternalDocument,
  NormalizedJudicialCost,
  NormalizedSessionMinute,
} from '../domain/models';
import { createIntegrationNotification } from '../repositories/notifications.repository';

type SmartActionInput = {
  orgId: string;
  actorUserId: string;
  matter: MatterReference | null;
  enforcementRequests?: NormalizedEnforcementRequest[];
  judicialCosts?: NormalizedJudicialCost[];
  documents?: NormalizedExternalDocument[];
  sessionMinutes?: NormalizedSessionMinute[];
};

export async function runNajizSmartActions(input: SmartActionInput) {
  if (!input.matter) {
    return { tasksCreated: 0 };
  }

  const assigneeId = input.matter.assignedUserId ?? input.actorUserId;
  let tasksCreated = 0;

  if ((input.enforcementRequests?.length ?? 0) > 0) {
    const task = await ensureMatterTask({
      orgId: input.orgId,
      matterId: input.matter.id,
      assigneeId,
      createdBy: input.actorUserId,
      title: '[Najiz] مراجعة طلبات التنفيذ الجديدة',
      description: buildListDescription(
        'تمت مزامنة طلبات تنفيذ جديدة وتحتاج مراجعة الإجراء النظامي وربطها بخطة العمل الداخلية.',
        input.enforcementRequests?.map((request) => request.requestNumber || request.externalId) ?? [],
      ),
      priority: 'high',
    });

    if (task.created) {
      tasksCreated += 1;
      await createIntegrationNotification({
        orgId: input.orgId,
        recipientUserId: assigneeId,
        category: 'integration_sync',
        title: 'طلبات تنفيذ جديدة من ناجز',
        body: `تم إنشاء مهمة متابعة للقضية "${input.matter.title}" بعد مزامنة ${input.enforcementRequests?.length ?? 0} طلب/طلبات تنفيذ.`,
        entityType: 'task',
        entityId: task.id,
        payloadJson: { matter_id: input.matter.id, kind: 'enforcement_requests' },
      });
    }
  }

  const actionableCosts = (input.judicialCosts ?? []).filter((cost) => cost.status === 'pending' || cost.status === 'overdue');
  if (actionableCosts.length > 0) {
    const task = await ensureMatterTask({
      orgId: input.orgId,
      matterId: input.matter.id,
      assigneeId,
      createdBy: input.actorUserId,
      title: '[Najiz] مراجعة الرسوم والفواتير القضائية',
      description: buildListDescription(
        'تم رصد رسوم أو فواتير قضائية تحتاج متابعة داخلية أو ربطًا بالفوترة والتحصيل.',
        actionableCosts.map((cost) => cost.invoiceReference || cost.externalId),
      ),
      priority: actionableCosts.some((cost) => cost.status === 'overdue') ? 'high' : 'medium',
    });

    if (task.created) {
      tasksCreated += 1;
      await createIntegrationNotification({
        orgId: input.orgId,
        recipientUserId: assigneeId,
        category: 'integration_sync',
        title: 'رسوم قضائية بحاجة متابعة',
        body: `تم إنشاء مهمة لمراجعة ${actionableCosts.length} رسوم/فواتير في القضية "${input.matter.title}".`,
        entityType: 'task',
        entityId: task.id,
        payloadJson: { matter_id: input.matter.id, kind: 'judicial_costs' },
      });
    }
  }

  if ((input.documents?.length ?? 0) > 0) {
    const task = await ensureMatterTask({
      orgId: input.orgId,
      matterId: input.matter.id,
      assigneeId,
      createdBy: input.actorUserId,
      title: '[Najiz] معالجة مستندات جديدة',
      description: buildListDescription(
        'تم استيراد مستندات جديدة من ناجز. راجعها وحدد ما يجب أرشفته أو إتاحته للعميل.',
        input.documents?.map((document) => document.fileName) ?? [],
      ),
      priority: 'medium',
    });

    if (task.created) {
      tasksCreated += 1;
      await createIntegrationNotification({
        orgId: input.orgId,
        recipientUserId: assigneeId,
        category: 'integration_sync',
        title: 'مستندات جديدة من ناجز',
        body: `تم إنشاء مهمة لمراجعة ${input.documents?.length ?? 0} مستند/مستندات جديدة للقضية "${input.matter.title}".`,
        entityType: 'task',
        entityId: task.id,
        payloadJson: { matter_id: input.matter.id, kind: 'documents' },
      });
    }
  }

  if ((input.sessionMinutes?.length ?? 0) > 0) {
    const task = await ensureMatterTask({
      orgId: input.orgId,
      matterId: input.matter.id,
      assigneeId,
      createdBy: input.actorUserId,
      title: '[Najiz] مراجعة محاضر الجلسات',
      description: buildListDescription(
        'تم استيراد محاضر جلسات جديدة من ناجز وتحتاج مراجعة وتحديث الاستراتيجية والمتابعة مع العميل.',
        input.sessionMinutes?.map((minute) => minute.sessionReference || minute.externalId) ?? [],
      ),
      priority: 'high',
    });

    if (task.created) {
      tasksCreated += 1;
      await createIntegrationNotification({
        orgId: input.orgId,
        recipientUserId: assigneeId,
        category: 'integration_sync',
        title: 'محاضر جلسات جديدة',
        body: `تم إنشاء مهمة لمراجعة ${input.sessionMinutes?.length ?? 0} محضر/محاضر جلسات للقضية "${input.matter.title}".`,
        entityType: 'task',
        entityId: task.id,
        payloadJson: { matter_id: input.matter.id, kind: 'session_minutes' },
      });
    }
  }

  return { tasksCreated };
}

async function ensureMatterTask(input: {
  orgId: string;
  matterId: string;
  assigneeId: string;
  createdBy: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}) {
  const supabase = createSupabaseServerClient();
  const { data: existing, error: lookupError } = await supabase
    .from('tasks')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('matter_id', input.matterId)
    .eq('title', input.title)
    .in('status', ['todo', 'doing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existing?.id) {
    return { id: String(existing.id), created: false };
  }

  const { data: created, error: createError } = await supabase
    .from('tasks')
    .insert({
      org_id: input.orgId,
      matter_id: input.matterId,
      title: input.title,
      description: input.description,
      assignee_id: input.assigneeId,
      priority: input.priority,
      status: 'todo',
      created_by: input.createdBy,
    })
    .select('id')
    .single();

  if (createError || !created) {
    throw createError ?? new Error('smart_task_create_failed');
  }

  return { id: String(created.id), created: true };
}

function buildListDescription(prefix: string, identifiers: string[]) {
  const normalized = Array.from(new Set(identifiers.filter(Boolean))).slice(0, 8);
  if (!normalized.length) {
    return prefix;
  }

  return `${prefix}\n\nالعناصر المرتبطة:\n- ${normalized.join('\n- ')}`;
}
