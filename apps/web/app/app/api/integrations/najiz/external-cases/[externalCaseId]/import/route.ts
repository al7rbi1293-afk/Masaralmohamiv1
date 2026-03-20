import { NextRequest, NextResponse } from 'next/server';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import {
  getExternalCaseById,
  linkExternalCaseToMatter,
} from '@/lib/integrations/repositories/external-cases.repository';
import { deleteMatter, createMatter } from '@/lib/matters';
import { getOrgPlanLimits } from '@/lib/plan-limits';

export const runtime = 'nodejs';

type RouteParams = {
  externalCaseId: string;
};

export async function POST(request: NextRequest, { params }: { params: RouteParams }) {
  let createdMatterId: string | null = null;

  try {
    const actor = await requireIntegrationActor({
      allowedRoles: ['admin', 'owner', 'lawyer', 'assistant'],
    });
    const { limits } = await getOrgPlanLimits(actor.orgId);
    if (!limits.najiz_integration) {
      return redirectWithMessage(request, '/app/external/najiz', 'تكاملات ناجز متاحة فقط لنسخة الشركات.');
    }

    const externalCase = await getExternalCaseById(actor.orgId, params.externalCaseId);
    if (!externalCase) {
      return redirectWithMessage(request, '/app/external/najiz', 'القضية الخارجية غير موجودة.');
    }

    if (externalCase.matter_id) {
      return NextResponse.redirect(
        new URL(
          `/app/matters/${externalCase.matter_id}?success=${encodeURIComponent('القضية مربوطة مسبقًا وتم فتحها.')}`,
          request.url,
        ),
        { status: 303 },
      );
    }

    const createdMatter = await createMatter({
      title: externalCase.title,
      summary: buildImportedSummary(externalCase),
      najiz_case_number: externalCase.case_number ?? null,
      is_private: false,
      status: 'new',
    });
    createdMatterId = createdMatter.id;

    const linked = await linkExternalCaseToMatter({
      orgId: actor.orgId,
      externalCaseId: externalCase.id,
      matterId: createdMatter.id,
    });

    if (!linked) {
      const refreshed = await getExternalCaseById(actor.orgId, params.externalCaseId);
      if (refreshed?.matter_id) {
        await deleteMatter(createdMatter.id).catch(() => undefined);
        return NextResponse.redirect(
          new URL(
            `/app/matters/${refreshed.matter_id}?success=${encodeURIComponent('تم ربط القضية مسبقًا وفتح القضية الحالية.')}`,
            request.url,
          ),
          { status: 303 },
        );
      }

      throw new Error('تعذر ربط القضية الخارجية بالقضية الداخلية.');
    }

    return NextResponse.redirect(
      new URL(
        `/app/matters/${createdMatter.id}?success=${encodeURIComponent('تم استيراد القضية من ناجز وربطها بالقضية الداخلية.')}`,
        request.url,
      ),
      { status: 303 },
    );
  } catch (error) {
    if (createdMatterId) {
      await deleteMatter(createdMatterId).catch(() => undefined);
    }

    return redirectWithMessage(
      request,
      '/app/external/najiz',
      toFriendlyMessage(error),
    );
  }
}

function buildImportedSummary(externalCase: {
  case_number: string | null;
  title: string;
  court: string | null;
  status: string | null;
}) {
  const parts = [
    'قضية مستوردة من ناجز.',
    externalCase.case_number ? `رقم ناجز: ${externalCase.case_number}` : null,
    externalCase.court ? `المحكمة: ${externalCase.court}` : null,
    externalCase.status ? `الحالة: ${externalCase.status}` : null,
  ].filter(Boolean);

  return parts.join('\n');
}

function toFriendlyMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (normalized.includes('enterprise_plan_required')) {
    return 'تكاملات ناجز متاحة فقط لنسخة الشركات.';
  }

  if (normalized.includes('not_authorized') || normalized.includes('not_authenticated')) {
    return 'لا تملك صلاحية تنفيذ هذا الإجراء.';
  }

  if (normalized.includes('client_required')) {
    return 'تعذر استيراد القضية لأن النظام يتطلب موكلًا قبل إنشاء القضية.';
  }

  if (normalized.includes('not_found')) {
    return 'القضية الخارجية غير موجودة.';
  }

  return message || 'تعذر استيراد القضية من ناجز.';
}

function redirectWithMessage(request: NextRequest, path: string, message: string) {
  return NextResponse.redirect(
    new URL(`${path}?error=${encodeURIComponent(message)}`, request.url),
    { status: 303 },
  );
}
