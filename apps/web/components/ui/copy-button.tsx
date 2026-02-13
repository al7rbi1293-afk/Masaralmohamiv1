'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type CopyButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
};

export function CopyButton({
  value,
  label = 'نسخ',
  copiedLabel = 'تم النسخ',
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // No-op: user can copy manually from the text.
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onCopy}
      className={className}
      aria-label={label}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}

