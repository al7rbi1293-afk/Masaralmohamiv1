import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/token-crypto';
import { logError, logInfo } from '@/lib/logger';

const sendSchema = z.object({
    matter_id: z.string().uuid().optional(),
    to: z.string().email(),
    subject: z.string().min(1).max(500),
    body: z.string().min(1).max(10000),
    cc: z.string().email().optional(),
});

/**
 * POST /api/email/send
 * Sends an email via the user's connected mailbox and logs it.
 */
export async function POST(request: NextRequest) {
    const user = await getCurrentAuthUser();
    if (!user) return NextResponse.json({ message: 'يرجى تسجيل الدخول.' }, { status: 401 });

    let orgId: string;
    try { orgId = await requireOrgIdForUser(); } catch {
        return NextResponse.json({ message: 'لا يوجد مكتب مفعّل.' }, { status: 403 });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
        return NextResponse.json({ message: 'بيانات غير صالحة.' }, { status: 400 });
    }

    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'خطأ.' }, { status: 400 });
    }

    // Get user's email account
    const adminClient = createSupabaseServerClient();
    const { data: account, error: acctError } = await adminClient
        .from('email_accounts')
        .select('*')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .single();

    if (acctError || !account) {
        return NextResponse.json({ message: 'لم يتم ربط بريد إلكتروني.' }, { status: 400 });
    }

    const accessToken = decryptToken(account.access_token_enc);

    // Send via Microsoft Graph
    if (account.provider === 'microsoft') {
        const mailBody = {
            message: {
                subject: parsed.data.subject,
                body: { contentType: 'Text', content: parsed.data.body },
                toRecipients: [{ emailAddress: { address: parsed.data.to } }],
                ...(parsed.data.cc ? { ccRecipients: [{ emailAddress: { address: parsed.data.cc } }] } : {}),
            },
            saveToSentItems: true,
        };

        const sendRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(mailBody),
        });

        if (!sendRes.ok) {
            const errText = await sendRes.text();
            logError('email_send_failed', { status: sendRes.status, body: errText });
            return NextResponse.json({ message: 'فشل إرسال البريد.' }, { status: 500 });
        }
    }

    // Log the sent message
    const supabase = createSupabaseServerRlsClient();
    const { data: msg } = await supabase
        .from('email_messages')
        .insert({
            org_id: orgId,
            provider_message_id: `sent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            direction: 'out',
            from_email: account.email,
            to_emails: parsed.data.to,
            cc_emails: parsed.data.cc ?? null,
            sent_at: new Date().toISOString(),
            snippet: parsed.data.body.slice(0, 300),
            body_preview: parsed.data.body.slice(0, 500),
        })
        .select('id')
        .single();

    // Link to matter if provided
    if (parsed.data.matter_id && msg) {
        await supabase.from('matter_email_links').insert({
            org_id: orgId,
            matter_id: parsed.data.matter_id,
            message_id: msg.id,
        });
    }

    logInfo('email_sent', { orgId, to: parsed.data.to, matterId: parsed.data.matter_id });
    return NextResponse.json({ success: true });
}
