'use client';

import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { buttonVariants } from '@/components/ui/button';

type ConfirmActionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  triggerLabel: string;
  triggerVariant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  triggerSize?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function ConfirmActionForm({
  action,
  confirmTitle,
  confirmMessage,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  destructive = true,
  triggerLabel,
  triggerVariant = 'outline',
  triggerSize = 'sm',
  className = '',
}: ConfirmActionFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <form action={action} ref={formRef} className={className}>
      <button
        type="button"
        className={buttonVariants(triggerVariant, triggerSize)}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>

      <ConfirmDialog
        open={open}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={destructive}
        onCancel={() => setOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}

