'use client';

import * as React from 'react';
import { X } from 'lucide-react';

const SlideOverContext = React.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
} | null>(null);

export function SlideOver({ children, open: controlledOpen, onOpenChange }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const setOpen = React.useCallback((newOpen: boolean) => {
        if (!isControlled) {
            setUncontrolledOpen(newOpen);
        }
        onOpenChange?.(newOpen);
    }, [isControlled, onOpenChange]);

    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        }
    }, [open]);

    return (
        <SlideOverContext.Provider value={{ open, setOpen }}>
            {children}
        </SlideOverContext.Provider>
    );
}

export function SlideOverTrigger({
    asChild,
    children,
}: {
    asChild?: boolean;
    children: React.ReactNode;
}) {
    const context = React.useContext(SlideOverContext);
    if (!context) throw new Error('SlideOverTrigger must be used within SlideOver');

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement, {
            onClick: (e: React.MouseEvent) => {
                (children.props as any).onClick?.(e);
                context.setOpen(true);
            },
        });
    }

    return (
        <button onClick={() => context.setOpen(true)}>{children}</button>
    );
}

export function SlideOverContent({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    const context = React.useContext(SlideOverContext);
    if (!context) throw new Error('SlideOverContent must be used within SlideOver');

    if (!context.open) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={() => context.setOpen(false)}
            />
            {/* Panel (Slides in from left in RTL, but flex-justify-end puts it on the logical start/end. Actually, let's explicitly pin it to the left side for RTL) */}
            <div className={`relative z-50 w-full max-w-md bg-white shadow-2xl dark:bg-slate-900 border-r border-brand-border dark:border-slate-800 h-full flex flex-col pt-6 pb-6 animate-in slide-in-from-left duration-300 ${className}`}>
                <div className="absolute top-4 left-4 rtl:left-auto rtl:right-4 z-10">
                    <button
                        onClick={() => context.setOpen(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                        <X className="h-5 w-5" />
                        <span className="sr-only">إغلاق</span>
                    </button>
                </div>
                <div className="h-full overflow-y-auto px-6">
                    {children}
                </div>
            </div>
        </div>
    );
}

export function SlideOverHeader({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`flex flex-col space-y-1.5 pb-6 ${className || ''}`}
            {...props}
        />
    );
}

export function SlideOverTitle({
    className,
    ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h3
            className={`text-xl font-semibold text-brand-navy dark:text-slate-100 ${className || ''}`}
            {...props}
        />
    );
}

export function SlideOverDescription({
    className,
    ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p
            className={`text-sm text-slate-500 dark:text-slate-400 ${className || ''}`}
            {...props}
        />
    );
}
