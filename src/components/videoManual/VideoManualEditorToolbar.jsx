import { useLanguage } from "../../contexts/LanguageContext";

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
  const { t } = useLanguage();
  if (hasUnsavedChanges) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {t("vmUnsaved")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-outline">
      <span className={`h-1.5 w-1.5 rounded-full ${revisionNumber > 0 ? "bg-emerald-500" : "bg-outline-variant"}`} />
      {revisionNumber > 0 ? `${t("vmSavedAs")} ${String(revisionNumber).padStart(2, "0")}` : t("vmNoRevisions")}
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
  stepMode = false,
  stepTitle = "",
  onApplyStep,
}) {
  const { t } = useLanguage();

  return (
    <header className="relative z-30 flex h-14 flex-shrink-0 items-center gap-3 border-b border-separator bg-surface px-4 text-sm shadow-sm">
      {/* Left: navigation + project identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <IconButton icon="arrow_back" title={t("vmBackToProjects")} onClick={onBack} disabled={busy} />
        <div className="min-w-0">
          <div className="max-w-[320px] truncate text-sm font-black leading-tight text-on-surface">
            {stepMode ? `${projectTitle || "Video Manual"} › ${stepTitle}` : (projectTitle || "Video Manual")}
          </div>
          {stepMode ? (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${hasUnsavedChanges ? "text-amber-700 dark:text-amber-300" : "text-outline"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${hasUnsavedChanges ? "bg-amber-500" : "bg-emerald-500"}`} />
              {hasUnsavedChanges ? t("vmUnsaved") : t("Step saved")}
            </span>
          ) : (
            <SaveState hasUnsavedChanges={hasUnsavedChanges} revisionNumber={revisionNumber} />
          )}
        </div>
      </div>

      {/* Center: editing tools */}
      <div className="hidden items-center gap-1 md:flex">
        <IconButton icon="undo" title={t("vmUndo")} onClick={onUndo} />
        <IconButton icon="redo" title={t("vmRedo")} onClick={onRedo} />
        <Divider />
        <IconButton icon="zoom_out" title={t("vmZoomOut")} onClick={onZoomOut} />
        <button
          type="button"
          onClick={onAutoFit}
          className="h-8 rounded-lg px-3 text-xs font-bold text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
          title={t("vmFitTitle")}
        >
          {t("vmFit")}
        </button>
        <IconButton icon="zoom_in" title={t("vmZoomIn")} onClick={onZoomIn} />
      </div>

      {/* Right: save / history / export */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {stepMode ? (
          <>
            <ToolbarButton icon="save" onClick={onSaveRevision} disabled={saving || busy} title={t("Save this step")}>
              <span className="hidden lg:inline">{t("Save step")}</span>
            </ToolbarButton>
            <button
              type="button"
              onClick={onApplyStep}
              disabled={saving || busy}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-on-primary shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon className="text-[18px]">check</Icon>
              {t("Apply changes and return")}
            </button>
          </>
        ) : (
          <>
          <ToolbarButton icon="save" onClick={onSaveRevision} disabled={saving || busy} title={t("vmSaveRevisionTitle")}>
            <span className="hidden lg:inline">{t("vmSaveRevision")}</span>
          </ToolbarButton>
          <ToolbarButton icon="history" onClick={onShowHistory} disabled={busy} title={t("vmHistoryTitle")}>
            <span className="hidden lg:inline">{t("vmHistory")}</span>
          </ToolbarButton>

          <button
            type="button"
            onClick={onExport}
            disabled={saving || busy}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-on-primary shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon className={busy ? "animate-spin text-[18px]" : "text-[18px]"}>{busy ? "progress_activity" : "download"}</Icon>
            {busy ? t("vmExporting") : t("vmExport")}
          </button>
          </>
        )}
      </div>
    </header>
  );
}
