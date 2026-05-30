function Icon({ children, className = "text-[15px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export default function VideoManualClipActionBar({ selectedClip, onTrimClip, onDeleteClip }) {
  const hasSelection = !!selectedClip;
  const canTrim = selectedClip?.clip?.asset?.type === "video";

  return (
    <div className="flex h-9 flex-shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={onTrimClip}
        disabled={!canTrim}
        className="inline-flex h-7 items-center gap-1 rounded bg-slate-200 px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        title="Trim selected video clip"
      >
        <Icon>content_cut</Icon>
        Trim
      </button>
      <button
        type="button"
        onClick={onDeleteClip}
        disabled={!hasSelection}
        className="inline-flex h-7 items-center gap-1 rounded bg-red-50 px-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
        title="Delete selected clip"
      >
        <Icon>delete</Icon>
        Delete
      </button>
      <div className="flex-1" />
    </div>
  );
}