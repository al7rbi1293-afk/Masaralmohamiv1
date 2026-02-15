import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { decryptToken, encryptToken } from '@/lib/token-crypto';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/email-sync
 * Vercel Cron: syncs messages from connected email accounts.
 */
export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }
    }

    const adminClient = createSupabaseServerClient();

    // Fetch all connected email accounts
    const { data: accounts, error: fetchError } = await adminClient
        .from('email_accounts')
        .select('*')
        .order('updated_at', { ascending: true })
        .limit(50);

    if (fetchError) {
        logError('email_sync_fetch_error', { error: fetchError.message });
        return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
    }

    let synced = 0;
    let failed = 0;

    for (const account of accounts ?? []) {
        try {
            let accessToken = decryptToken(account.access_token_enc);

            // Refresh token if expired
            if (account.token_expires_at && new Date(account.token_expires_at) <= new Date()) {
                if (!account.refresh_token_enc) {
                    logError('email_sync_no_refresh_token', { accountId: account.id });
                    failed++;
                    continue;
                }

                const refreshToken = decryptToken(account.refresh_token_enc);
                const newTokens = await refreshMicrosoftToken(refreshToken);
                if (!newTokens) {
                    failed++;
                    continue;
                }

                accessToken = newTokens.access_token;
                await adminClient
                    .from('email_accounts')
                    .update({
                        access_token_enc: encryptToken(newTokens.access_token),
                        refresh_token_enc: newTokens.refresh_token
                            ? encryptToken(newTokens.refresh_token)
                            : account.refresh_token_enc,
                        token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
                    })
                    .eq('id', account.id);
            }

            // Fetch recent messages from Microsoft Graph
            if (account.provider === 'microsoft') {
                const messages = await fetchMicrosoftMessages(accessToken, account.sync_cursor);
                if (messages) {
                    for (const msg of messages.value ?? []) {
                        // Upsert thread
                        const threadId = msg.conversationId || msg.id;
                        const { data: thread } = await adminClient
                            .from('email_threads')
                            .upsert(
                                {
                                    org_id: account.org_id,
                                    provider_thread_id: threadId,
                                    subject: msg.subject || null,
                                },
                                { onConflict: 'org_id,provider_thread_id' },
                            )
                            .select('id')
                            .single();

                        // Insert message
                        await adminClient
                            .from('email_messages')
                            .upsert(
                                {
                                    org_id: account.org_id,
                                    thread_id: thread?.id ?? null,
                                    provider_message_id: msg.id,
                                    direction: msg.from?.emailAddress?.address === account.email ? 'out' : 'in',
                                    from_email: msg.from?.emailAddress?.address ?? null,
                                    to_emails: msg.toRecipients?.map((r: any) => r.emailAddress?.address).join(', ') ?? null,
                                    cc_emails: msg.ccRecipients?.map((r: any) => r.emailAddress?.address).join(', ') ?? null,
                                    sent_at: msg.sentDateTime ?? null,
                                    snippet: msg.bodyPreview?.slice(0, 300) ?? null,
                                    body_preview: msg.bodyPreview ?? null,
                                },
                                { onConflict: 'org_id,provider_message_id' },
                            );
                    }

                    // Update sync cursor
                    if (messages['@odata.deltaLink'] || messages['@odata.nextLink']) {
                        await adminClient
                            .from('email_accounts')
                            .update({ sync_cursor: messages['@odata.deltaLink'] || messages['@odata.nextLink'] })
                            .eq('id', account.id);
                    }

                    synced++;
                }
            }
        } catch (err) {
            logError('email_sync_account_error', {
                accountId: account.id,
                error: err instanceof Error ? err.message : 'unknown',
            });
            failed++;
        }
    }

    logInfo('email_sync_complete', { synced, failed });
    return NextResponse.json({ ok: true, synced, failed });
}

async function refreshMicrosoftToken(refreshToken: string) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    try {
        const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

async function fetchMicrosoftMessages(accessToken: string, cursor?: string | null) {
    try {
        const url = cursor || 'https://graph.microsoft.com/v1.0/me/messages?$top=25&$orderby=sentDateTime desc&$select=id,conversationId,subject,from,toRecipients,ccRecipients,sentDateTime,bodyPreview';
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}
