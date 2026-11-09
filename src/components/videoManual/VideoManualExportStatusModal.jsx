import { useLanguage } from "../../contexts/LanguageContext";

function Icon({ children, className = "text-[20px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function getStatusTone(type, busy) {
  if (type === "error") {
    return {
      badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
      iconWrap: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-200",
      title: "text-red-700 dark:text-red-200",
      button: "bg-red-600 hover:bg-red-700 text-white",
    };
  }

  if (busy || type === "info") {
    return {
      badge: "bg-primary/10 text-primary",
      iconWrap: "bg-primary/10 text-primary",
      title: "text-primary",
      button: "bg-surface-container text-on-surface-variant",
    };
  }

  return {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    iconWrap: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200",
    title: "text-emerald-700 dark:text-emerald-200",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
  };
}

export default function VideoManualExportStatusModal({
  open,
  status,
  busy = false,
  onClose,
  onDownload,
  onOpenUrl,
  onCopyUrl,
}) {
  const { t } = useLanguage();

  if (!open) return null;

  const type = status?.type || (busy ? "info" : "success");
  const progress = typeof status?.progress === "number"
    ? Math.max(0, Math.min(100, status.progress))
    : null;
  const badgeLabel = t(status?.status || "") || (busy ? t("PROCESSING") : type === "error" ? t("FAILED") : t("COMPLETE"));
  const title = t(status?.title || "") || (busy ? t("Preparing export") : t("Export Complete!"));
  const message = t(status?.message || "") || (busy ? t("Please keep this page open while the export finishes.") : t("The flattened deployed video is ready."));
  const tone = getStatusTone(type, busy);
  const canShowActions = !busy && type === "success";

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-manual-export-status-title"
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-surface shadow-[0_30px_120px_-40px_rgba(15,23,42,0.6)]"
      >
        <div className="border-b border-separator px-6 py-5">
          <div className="flex items-center gap-2 text-sm font-black text-on-surface">
            <Icon className="text-[18px] text-primary">download</Icon>
            <h3 id="video-manual-export-status-title">{t("Export Video")}</h3>
          </div>
        </div>

        <div className="px-6 pb-6 pt-5 text-center">
          <div className={`mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full ${tone.iconWrap}`}>
            <Icon className={busy ? "animate-spin text-[26px]" : "text-[26px]"}>
              {type === "error" ? "error" : busy ? "progress_activity" : "check_circle"}
            </Icon>
          </div>

          <div className="mt-4">
            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${tone.badge}`}>
              {badgeLabel}
            </span>
            <p className={`mt-4 text-xl font-black ${tone.title}`}>{title}</p>
            <p className="mt-2 text-sm font-semibold text-on-surface-variant">{message}</p>
            {busy ? (
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-outline">
                {t("Refresh and close are blocked until the export finishes.")}
              </p>
            ) : null}
          </div>

          {progress != null ? (
            <div className="mt-5 overflow-hidden rounded-full bg-surface-container">
              <div className="h-2 rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          {canShowActions ? (
            <div className="mt-6 space-y-3">
              {typeof onDownload === "function" ? (
                <button
                  type="button"
                  onClick={onDownload}
                  className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-black transition ${tone.button}`}
                >
                  <Icon className="text-[18px]">download</Icon>
                  {t("Download Video")}
                </button>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                {typeof onOpenUrl === "function" ? (
                  <button
                    type="button"
                    onClick={onOpenUrl}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-separator bg-surface text-sm font-black text-on-surface transition hover:bg-surface-container"
                  >
                    <Icon className="text-[18px]">open_in_new</Icon>
                    {t("Open URL")}
                  </button>
                ) : <div />}

                {typeof onCopyUrl === "function" ? (
                  <button
                    type="button"
                    onClick={onCopyUrl}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-separator bg-surface text-sm font-black text-on-surface transition hover:bg-surface-container"
                  >
                    <Icon className="text-[18px]">content_copy</Icon>
                    {t("Copy URL")}
                  </button>
                ) : <div />}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-surface-container text-sm font-black text-on-surface-variant transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("Close")}
          </button>
        </div>
      </section>
    </div>
  );
}