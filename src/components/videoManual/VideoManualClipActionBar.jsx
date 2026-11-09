function Icon({ children, className = "text-[15px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export default function VideoManualClipActionBar({ selectedClip, onTrimClip, onDeleteClip }) {
  const hasSelection = !!selectedClip;
  const canTrim = selectedClip?.clip?.asset?.type === "video";

  return (
    <div className="flex h-9 flex-shrink-0 items-center gap-2 border-b border-separator bg-surface-container-low px-3">
      <button
        type="button"
        onClick={onTrimClip}
        disabled={!canTrim}
        className="inline-flex h-7 items-center gap-1 rounded bg-surface-container-high px-2 text-xs font-semibold text-on-surface-variant transition hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-50"
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