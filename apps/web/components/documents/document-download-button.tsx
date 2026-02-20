'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

type DocumentDownloadButtonProps = {
    storagePath?: string | null;
    label?: string;
    variant?: 'outline' | 'ghost' | 'primary' | 'secondary';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
};

export function DocumentDownloadButton({
    storagePath,
    label = 'تنزيل',
    variant = 'ghost',
    size = 'sm',
    className,
}: DocumentDownloadButtonProps) {
    const [busy, setBusy] = useState(false);

    async function download() {
        if (!storagePath) return;
        setBusy(true);
        try {
            const response = await fetch('/app/api/documents/download-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storage_path: storagePath }),
            });
            const json = await response.json().catch(() => ({}));
            if (!response.ok) {
                alert(json?.error ?? 'تعذر تجهيز رابط التنزيل.');
                return;
            }
            const url = String(json?.signedDownloadUrl ?? '');
            if (!url) {
                alert('تعذر تجهيز رابط التنزيل.');
                return;
            }
            window.open(url, '_blank', 'noreferrer');
        } catch {
            alert('تعذر تجهيز رابط التنزيل.');
        } finally {
            setBusy(false);
        }
    }

    if (!storagePath) return null;

    return (
        <Button type="button" variant={variant} size={size} disabled={busy} onClick={download} className={className}>
            {busy ? '...' : label}
        </Button>
    );
}
