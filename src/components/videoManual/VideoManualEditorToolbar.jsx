function Icon({ children, className = "text-[18px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function ToolbarButton({ children, icon, onClick, disabled = false, title = "" }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {icon ? <Icon className="text-[16px]">{icon}</Icon> : null}
      {children}
    </button>
  );
}

function IconButton({ icon, onClick, title, disabled = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <Icon>{icon}</Icon>
    </button>
  );
}

export default function VideoManualEditorToolbar({
  projectTitle,
  saving,
  onBack,
  onUndo,
  onRedo,
  onSaveRevision,
  onShowHistory,
  onZoomOut,
  onAutoFit,
  onZoomIn,
  onExport,
}) {
  return (
    <header className="relative z-30 flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ToolbarButton icon="arrow_back" onClick={onBack}>Projects</ToolbarButton>

        <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-800" />

        <IconButton icon="undo" title="Undo" onClick={onUndo} />
        <IconButton icon="redo" title="Redo" onClick={onRedo} />

        <div className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-slate-800 sm:block" />

        <div className="hidden items-center gap-2 lg:flex">
          <ToolbarButton icon="save" onClick={onSaveRevision} disabled={saving}>Save Revision</ToolbarButton>
          <ToolbarButton icon="history" onClick={onShowHistory}>History</ToolbarButton>
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 hidden min-w-0 -translate-x-1/2 flex-col items-center sm:flex">
        <span className="max-w-[260px] truncate text-sm font-black text-slate-900 dark:text-white">
          {projectTitle || "Video Manual"}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Shotstack editor</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        <div className="hidden items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 md:flex">
          <button
            type="button"
            onClick={onZoomOut}
            className="flex h-9 w-10 items-center justify-center border-r border-slate-200 text-slate-500 transition hover:bg-white hover:text-slate-800 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            title="Zoom out"
          >
            <Icon>zoom_out</Icon>
          </button>
          <button
            type="button"
            onClick={onAutoFit}
            className="h-9 min-w-[132px] px-4 text-xs font-black text-slate-700 transition hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Auto-Fit Page
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="flex h-9 w-10 items-center justify-center border-l border-slate-200 text-slate-500 transition hover:bg-white hover:text-slate-800 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            title="Zoom in"
          >
            <Icon>zoom_in</Icon>
          </button>
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-500 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon className="text-[18px]">download</Icon>
          Export
        </button>
      </div>
    </header>
  );
}