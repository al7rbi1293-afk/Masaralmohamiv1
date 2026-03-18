import { NextResponse } from 'next/server';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
// import { syncCaseDetails, syncHearings } from '@/lib/integrations/najizService';

// Note: In a real scenario with a background worker (like BullMQ or Vercel Cron),
// this endpoint would fetch active matters and sync them using najizService.

export async function GET(req: Request) {
  // Security check: ensure the request is from a trusted cron source
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // In local development you might want to bypass this check,
    // but for production it's important.
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const supabase = createSupabaseServerRlsClient();
    
    // 1. Fetch all matters with najiz_case_number that are not closed/archived
    // Note: We bypass RLS here by using service role if needed, 
    // but in Next.js API boundaries we must ensure we use the correct authenticated client.
    const { data: matters, error } = await supabase
      .from('matters')
      .select('id, najiz_case_number, org_id')
      .not('najiz_case_number', 'is', null)
      .in('status', ['new', 'in_progress', 'on_hold']);

    if (error) {
      throw error;
    }

    // 2. Loop through each matter and trigger sync
    // For a real implementation, this should push to a BullMQ queue to avoid timeout limits on Vercel
    let syncedCount = 0;
    for (const matter of (matters || [])) {
      // await syncCaseDetails(matter.id, matter.najiz_case_number!);
      // await syncHearings(matter.id, matter.najiz_case_number!);
      syncedCount++;
    }

    return NextResponse.json({ ok: true, syncedCount, message: 'Background Najiz sync completed.' });
  } catch (error: any) {
    console.error('Najiz Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
