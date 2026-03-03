type CopilotErrorStateProps = {
  message: string;
};

export function CopilotErrorState({ message }: CopilotErrorStateProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
      {message}
    </div>
  );
}
