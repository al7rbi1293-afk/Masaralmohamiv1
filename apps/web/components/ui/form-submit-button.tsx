'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { buttonVariants } from '@/components/ui/button';

type FormSubmitButtonProps = {
  children: ReactNode;
  pendingText?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function FormSubmitButton({
  children,
  pendingText = 'جارٍ التنفيذ...',
  variant = 'primary',
  size = 'md',
  className = '',
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${buttonVariants(variant, size)} ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
