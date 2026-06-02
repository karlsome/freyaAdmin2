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
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
      iconWrap: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-200",
      title: "text-blue-700 dark:text-blue-200",
      button: "bg-slate-100 text-slate-500",
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
  if (!open) return null;

  const type = status?.type || (busy ? "info" : "success");
  const progress = typeof status?.progress === "number"
    ? Math.max(0, Math.min(100, status.progress))
    : null;
  const badgeLabel = status?.status || (busy ? "PROCESSING" : type === "error" ? "FAILED" : "COMPLETE");
  const title = status?.title || (busy ? "Preparing export" : "Export Complete!");
  const message = status?.message || (busy ? "Please keep this page open while the export finishes." : "The flattened deployed video is ready.");
  const tone = getStatusTone(type, busy);
  const canShowActions = !busy && type === "success";

  return (
    <div className="fixed inset-0 z-[360] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-manual-export-status-title"
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_120px_-40px_rgba(15,23,42,0.6)] dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <Icon className="text-[18px] text-blue-500">download</Icon>
            <h3 id="video-manual-export-status-title">Export Video</h3>
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
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{message}</p>
            {busy ? (
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                Refresh and close are blocked until the export finishes.
              </p>
            ) : null}
          </div>

          {progress != null ? (
            <div className="mt-5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-2 rounded-full bg-blue-500 transition-[width] duration-300" style={{ width: `${progress}%` }} />
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
                  Download Video
                </button>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                {typeof onOpenUrl === "function" ? (
                  <button
                    type="button"
                    onClick={onOpenUrl}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Icon className="text-[18px]">open_in_new</Icon>
                    Open URL
                  </button>
                ) : <div />}

                {typeof onCopyUrl === "function" ? (
                  <button
                    type="button"
                    onClick={onCopyUrl}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Icon className="text-[18px]">content_copy</Icon>
                    Copy URL
                  </button>
                ) : <div />}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}