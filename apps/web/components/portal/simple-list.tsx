type SimpleListProps<T> = {
  items: T[];
  emptyText: string;
  renderItem: (item: T) => string;
};

export function SimpleList<T>({ items, emptyText, renderItem }: SimpleListProps<T>) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={index}
          className="rounded-lg border border-brand-border px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
