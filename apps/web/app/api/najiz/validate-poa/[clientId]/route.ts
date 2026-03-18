import { NextResponse } from 'next/server';
import { getOrgPlanLimits } from '@/lib/plan-limits';
import { requireOwner } from '@/lib/org';
import { validatePoA } from '@/lib/integrations/najizService';

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  try {
    const owner = await requireOwner();
    const { limits } = await getOrgPlanLimits(owner.orgId);
    if (!limits.najiz_integration) {
      return NextResponse.json({ error: 'هذه الميزة متاحة فقط لنسخة الشركات.' }, { status: 403 });
    }

    const body = await req.json();
    const { poaNumber } = body;

    if (!poaNumber) {
      return NextResponse.json({ error: 'Missing poaNumber' }, { status: 400 });
    }

    const result = await validatePoA(params.clientId, poaNumber);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
