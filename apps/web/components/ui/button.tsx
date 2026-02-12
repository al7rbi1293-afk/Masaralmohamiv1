import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export function buttonVariants(variant: Variant = 'primary', size: Size = 'md') {
  const base =
    'inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

  const variants: Record<Variant, string> = {
    primary: 'bg-brand-emerald text-white hover:bg-green-600',
    secondary:
      'bg-brand-navy text-white hover:bg-brand-navy/90 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100',
    outline:
      'border border-brand-border bg-white text-brand-text hover:border-brand-navy hover:text-brand-navy dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500',
    ghost: 'text-brand-navy hover:bg-brand-navy/5 dark:text-slate-100 dark:hover:bg-slate-800',
  };

  const sizes: Record<Size, string> = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-4 text-sm',
    lg: 'h-12 px-5 text-base',
  };

  return `${base} ${variants[variant]} ${sizes[size]}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonProps) {
  return (
    <button className={`${buttonVariants(variant, size)} ${className}`} {...props}>
      {children}
    </button>
  );
}
