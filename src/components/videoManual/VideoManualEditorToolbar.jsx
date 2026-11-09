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

function Divider() {
  return <div className="mx-1 h-6 w-px flex-shrink-0 bg-separator" />;
}

function SaveState({ hasUnsavedChanges, revisionNumber }) {
  if (hasUnsavedChanges) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Unsaved changes
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-outline">
      <span className={`h-1.5 w-1.5 rounded-full ${revisionNumber > 0 ? "bg-emerald-500" : "bg-outline-variant"}`} />
      {revisionNumber > 0 ? `Saved as Rev ${String(revisionNumber).padStart(2, "0")}` : "No revisions yet"}
    </span>
  );
}

export default function VideoManualEditorToolbar({
  projectTitle,
  hasUnsavedChanges = false,
  revisionNumber = 0,
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
      {/* Left: navigation + project identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <IconButton icon="arrow_back" title="Back to projects" onClick={onBack} disabled={busy} />
        <div className="min-w-0">
          <div className="max-w-[320px] truncate text-sm font-black leading-tight text-on-surface">
            {projectTitle || "Video Manual"}
          </div>
          <SaveState hasUnsavedChanges={hasUnsavedChanges} revisionNumber={revisionNumber} />
        </div>
      </div>

      {/* Center: editing tools */}
      <div className="hidden items-center gap-1 md:flex">
        <IconButton icon="undo" title="Undo" onClick={onUndo} />
        <IconButton icon="redo" title="Redo" onClick={onRedo} />
        <Divider />
        <IconButton icon="zoom_out" title="Zoom out" onClick={onZoomOut} />
        <button
          type="button"
          onClick={onAutoFit}
          className="h-8 rounded-lg px-3 text-xs font-bold text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
          title="Fit the canvas to the available space"
        >
          Fit
        </button>
        <IconButton icon="zoom_in" title="Zoom in" onClick={onZoomIn} />
      </div>

      {/* Right: save / history / export */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <ToolbarButton icon="save" onClick={onSaveRevision} disabled={saving || busy} title="Save the current state as a new revision">
          <span className="hidden lg:inline">Save Revision</span>
        </ToolbarButton>
        <ToolbarButton icon="history" onClick={onShowHistory} disabled={busy} title="Revision history">
          <span className="hidden lg:inline">History</span>
        </ToolbarButton>

        <button
          type="button"
          onClick={onExport}
          disabled={saving || busy}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-on-primary shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon className={busy ? "animate-spin text-[18px]" : "text-[18px]"}>{busy ? "progress_activity" : "download"}</Icon>
          {busy ? "Exporting" : "Export"}
        </button>
      </div>
    </header>
  );
}
