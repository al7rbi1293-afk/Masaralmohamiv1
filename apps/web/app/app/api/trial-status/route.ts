import { NextResponse } from 'next/server';
import { getTrialStatusForCurrentUser } from '@/lib/trial';

export async function GET() {
  try {
    const status = await getTrialStatusForCurrentUser();
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load trial status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
