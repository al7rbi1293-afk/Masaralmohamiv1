import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/org';
import { syncCaseDetails } from '@/lib/integrations/najizService';

export async function POST(
  req: Request,
  { params }: { params: { matterId: string } }
) {
  try {
    await requireOwner();
    const body = await req.json();
    const { caseNumber } = body;

    if (!caseNumber) {
      return NextResponse.json({ error: 'Missing caseNumber' }, { status: 400 });
    }

    const result = await syncCaseDetails(params.matterId, caseNumber);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
