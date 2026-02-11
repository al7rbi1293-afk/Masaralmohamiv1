export default function PlatformLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="h-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="h-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
