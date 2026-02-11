type FAQItem = {
  question: string;
  answer: string;
};

type FAQAccordionProps = {
  items: FAQItem[];
};

export function FAQAccordion({ items }: FAQAccordionProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <details
          key={item.question}
          className="group rounded-xl2 border border-brand-border bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <summary className="cursor-pointer list-none text-base font-semibold text-brand-navy marker:content-none dark:text-slate-100">
            {item.question}
          </summary>
          <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
