type CopilotActionItemsProps = {
  actionItems: string[];
  missingInfoQuestions: string[];
};

export function CopilotActionItems({ actionItems, missingInfoQuestions }: CopilotActionItemsProps) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-semibold text-brand-navy dark:text-slate-100">عناصر العمل</h3>
        {!actionItems.length ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">لا توجد عناصر عمل بعد.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-700 dark:text-slate-200">
            {actionItems.map((item, index) => (
              <li key={`${item}:${index}`}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-brand-navy dark:text-slate-100">البيانات الناقصة</h3>
        {!missingInfoQuestions.length ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">لا توجد أسئلة إضافية حاليًا.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-700 dark:text-slate-200">
            {missingInfoQuestions.map((item, index) => (
              <li key={`${item}:${index}`}>{item}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
