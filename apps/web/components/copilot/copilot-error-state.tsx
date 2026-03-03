type CopilotErrorStateProps = {
  message: string;
};

export function CopilotErrorState({ message }: CopilotErrorStateProps) {
  const isEnvIssue =
    message.includes('تهيئة') ||
    message.includes('متغيرات البيئة') ||
    message.includes('SUPABASE_') ||
    message.includes('OPENAI_');
  const missingVar = message.match(/\(([A-Z0-9_]+)\)/)?.[1] ?? null;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
      <p>{message}</p>
      {isEnvIssue ? (
        <ul className="mt-2 list-disc space-y-1 pr-5 text-xs text-red-700/90 dark:text-red-300/90">
          <li>في Vercel: افتح إعدادات المشروع ثم Environment Variables.</li>
          <li>أضف القيم المطلوبة للمساعد القانوني: SUPABASE_JWT_SECRET، و OPENAI_API_KEY للتحليل المتقدم.</li>
          {missingVar ? <li>المتغير المفقود في هذه المحاولة: {missingVar}</li> : null}
          <li>أعد نشر تطبيق الويب بعد حفظ المتغيرات.</li>
        </ul>
      ) : null}
    </div>
  );
}
