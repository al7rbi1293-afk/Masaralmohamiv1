import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
    try {
        const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        const hasNextPublic = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

        return NextResponse.json({
            success: true,
            serviceKeyExists: hasServiceKey,
            serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
            urlExists: hasNextPublic,
        });
    } catch (error: any) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
