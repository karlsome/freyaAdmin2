function Icon({ children, className = "text-[16px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function formatStepTime(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "0.0s";
  return `${seconds.toFixed(1)}s`;
}

export default function VideoManualStepsPanel({ steps, onSelectStep, onAddStep }) {
  return (
    <aside className="z-20 flex w-[180px] flex-shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 xl:w-[220px]">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3 dark:border-slate-800">
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Steps</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{steps.length}</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {steps.map((step, index) => (
          <button
            type="button"
            key={step.id}
            onClick={() => onSelectStep(step)}
            className="group relative flex w-full flex-col gap-1 overflow-hidden rounded-lg border border-slate-100 bg-sky-50/80 p-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
          >
            <span className="absolute inset-y-0 left-0 w-1 bg-blue-500" />
            <span className="flex items-center gap-2 pl-1">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-500 text-[10px] font-black text-white">{index + 1}</span>
              <span className="min-w-0 truncate text-sm font-black text-slate-800 dark:text-white">{step.label}</span>
            </span>
            <span className="pl-8 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {formatStepTime(step.startTime)} - {formatStepTime(step.endTime)}
            </span>
          </button>
        ))}

        {steps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs font-semibold text-slate-400 dark:border-slate-800">
            No video clips on the timeline
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-100 p-2 dark:border-slate-800">
        <button
          type="button"
          onClick={onAddStep}
          className="flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-slate-100 text-sm font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Icon>add</Icon>
          Add Step
        </button>
      </div>
    </aside>
  );
}