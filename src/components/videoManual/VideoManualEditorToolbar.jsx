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
      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface-container px-3 text-xs font-bold text-on-surface-variant transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
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
      className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon>{icon}</Icon>
    </button>
  );
}

export default function VideoManualEditorToolbar({
  projectTitle,
  saving,
  busy = false,
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
    <header className="relative z-30 flex h-14 flex-shrink-0 items-center gap-3 border-b border-separator bg-surface px-4 text-sm shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ToolbarButton icon="arrow_back" onClick={onBack} disabled={busy}>Projects</ToolbarButton>

        <div className="mx-1 h-6 w-px bg-surface-container-high" />

        <IconButton icon="undo" title="Undo" onClick={onUndo} />
        <IconButton icon="redo" title="Redo" onClick={onRedo} />

        <div className="mx-1 hidden h-6 w-px bg-surface-container-high sm:block" />

        <div className="hidden items-center gap-2 lg:flex">
          <ToolbarButton icon="save" onClick={onSaveRevision} disabled={saving || busy}>Save Revision</ToolbarButton>
          <ToolbarButton icon="history" onClick={onShowHistory} disabled={busy}>History</ToolbarButton>
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 hidden min-w-0 -translate-x-1/2 flex-col items-center sm:flex">
        <span className="max-w-[260px] truncate text-sm font-black text-on-surface">
          {projectTitle || "Video Manual"}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Shotstack editor</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        <div className="hidden items-center overflow-hidden rounded-xl border border-separator bg-surface-container-low md:flex">
          <button
            type="button"
            onClick={onZoomOut}
            className="flex h-9 w-10 items-center justify-center border-r border-separator text-on-surface-variant transition hover:bg-surface hover:text-on-surface"
            title="Zoom out"
          >
            <Icon>zoom_out</Icon>
          </button>
          <button
            type="button"
            onClick={onAutoFit}
            className="h-9 min-w-[132px] px-4 text-xs font-black text-on-surface transition hover:bg-surface"
          >
            Auto-Fit Page
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="flex h-9 w-10 items-center justify-center border-l border-separator text-on-surface-variant transition hover:bg-surface hover:text-on-surface"
            title="Zoom in"
          >
            <Icon>zoom_in</Icon>
          </button>
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={saving || busy}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-on-primary shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon className={busy ? "animate-spin text-[18px]" : "text-[18px]"}>{busy ? "progress_activity" : "download"}</Icon>
          {busy ? "Exporting" : "Export"}
        </button>
      </div>
    </header>
  );
}