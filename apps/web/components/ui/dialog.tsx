'use client';

import * as React from 'react';

const DialogContext = React.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
} | null>(null);

export function Dialog({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false);

    return (
        <DialogContext.Provider value={{ open, setOpen }}>
            {children}
        </DialogContext.Provider>
    );
}

export function DialogTrigger({
    asChild,
    children,
}: {
    asChild?: boolean;
    children: React.ReactNode;
}) {
    const context = React.useContext(DialogContext);
    if (!context) throw new Error('DialogTrigger must be used within Dialog');

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

export function DialogContent({ children }: { children: React.ReactNode }) {
    const context = React.useContext(DialogContext);
    if (!context) throw new Error('DialogContent must be used within Dialog');

    if (!context.open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                className="fixed inset-0"
                onClick={() => context.setOpen(false)}
            />
            <div className="z-50 w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-lg sm:rounded-lg dark:bg-slate-900 dark:border-slate-800">
                <div className="relative">
                    <button
                        onClick={() => context.setOpen(false)}
                        className="absolute left-0 top-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                    >
                        <span className="sr-only">Close</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                        >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                    {children}
                </div>
            </div>
        </div>
    );
}

export function DialogHeader({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`flex flex-col space-y-1.5 text-center sm:text-start ${className || ''}`}
            {...props}
        />
    );
}

export function DialogTitle({
    className,
    ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h3
            className={`text-lg font-semibold leading-none tracking-tight ${className || ''}`}
            {...props}
        />
    );
}

export function DialogDescription({
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
