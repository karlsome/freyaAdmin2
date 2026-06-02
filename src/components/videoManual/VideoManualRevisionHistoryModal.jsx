function Icon({ children, className = "text-[20px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function getRevisionId(revision) {
  return String(revision?._id?.$oid || revision?._id || revision?.revisionId || "");
}

function formatDateTime(value, fallback = "Unknown time") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
}

function getRevisionLabel(revision) {
  if (!revision) return "Current";
  return revision.revisionName || (revision.revisionNumber ? `Revision ${revision.revisionNumber}` : "Unnamed Revision");
}

function getLiveRevisionText(project) {
  if (!project?.deployedRevisionId) return "Factory live revision: Not deployed";

  const revisionLabel = project.deployedRevisionName
    || (project.deployedRevisionNumber ? `Revision ${project.deployedRevisionNumber}` : "Revision");
  return `Factory live revision: ${revisionLabel} | Deployed ${formatDateTime(project.deployedAt, "unknown time")}`;
}

export default function VideoManualRevisionHistoryModal({
  open,
  project,
  revisions,
  loading,
  error,
  previewRevision,
  actionId,
  canDeploy,
  deploymentStatus,
  onClose,
  onRefresh,
  onPreview,
  onRestore,
  onDeploy,
  onUndeploy,
  onBackToCurrent,
}) {
  if (!open) return null;

  const revisionItems = Array.isArray(revisions) ? revisions : [];
  const previewRevisionId = getRevisionId(previewRevision);
  const hasAction = Boolean(actionId);
  const hasLiveDeployment = Boolean(project?.deployedRevisionId);
  const deploymentDownloadUrl = deploymentStatus?.downloadUrl || project?.deployedVideoUrl || "";

  return (
    <div className="fixed inset-0 z-[345] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-manual-history-title"
        className="flex max-h-[84vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_120px_-40px_rgba(15,23,42,0.55)] dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">Revision History</p>
            <h3 id="video-manual-history-title" className="mt-1 truncate text-2xl font-black text-slate-900 dark:text-white">
              {project?.title || "Video Manual"}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>{getLiveRevisionText(project)}</span>
              {previewRevision ? (
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
                  Previewing {getRevisionLabel(previewRevision)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canDeploy && hasLiveDeployment && !previewRevision ? (
              <button
                type="button"
                onClick={onUndeploy}
                disabled={hasAction}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
              >
                <Icon className="text-[17px]">unpublished</Icon>
                Undeploy
              </button>
            ) : null}
            {previewRevision ? (
              <button
                type="button"
                onClick={onBackToCurrent}
                disabled={hasAction}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:bg-sky-500/15 dark:text-sky-200"
              >
                <Icon className="text-[17px]">arrow_back</Icon>
                Back to Current
              </button>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading || hasAction}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Refresh history"
            >
              <Icon className={loading ? "animate-spin text-[20px]" : "text-[20px]"}>refresh</Icon>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Close"
            >
              <Icon>close</Icon>
            </button>
          </div>
        </div>

        {deploymentStatus ? (
          <div className={`border-b px-6 py-4 ${deploymentStatus.type === "error" ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30" : deploymentStatus.type === "success" ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20" : "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20"}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-black uppercase tracking-[0.18em] ${deploymentStatus.type === "error" ? "text-red-600 dark:text-red-300" : deploymentStatus.type === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-blue-700 dark:text-blue-300"}`}>
                  {deploymentStatus.status || "Deployment"}
                </p>
                <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{deploymentStatus.title}</p>
                {deploymentStatus.message ? <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{deploymentStatus.message}</p> : null}
              </div>
              {deploymentStatus.type === "success" && deploymentDownloadUrl ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(deploymentDownloadUrl, "_blank")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700"
                  >
                    <Icon className="text-[16px]">open_in_new</Icon>
                    Open Video
                  </button>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(deploymentDownloadUrl).catch(() => {})}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200"
                  >
                    <Icon className="text-[16px]">content_copy</Icon>
                    Copy URL
                  </button>
                </div>
              ) : null}
            </div>
            {typeof deploymentStatus.progress === "number" ? (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/80 dark:bg-slate-900/60">
                <div className="h-full rounded-full bg-blue-500 transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, deploymentStatus.progress))}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6 dark:bg-slate-900/40">
          {loading ? (
            <p className="py-12 text-center text-sm font-bold text-slate-400">Loading revisions...</p>
          ) : null}

          {!loading && error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {!loading && !error && revisionItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-base font-black text-slate-700 dark:text-slate-200">No revisions saved yet.</p>
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Use Save Revision to capture the current project state.</p>
            </div>
          ) : null}

          {!loading && !error && revisionItems.length ? (
            <div className="space-y-3">
              {revisionItems.map((revision) => {
                const revisionId = getRevisionId(revision);
                const isPreviewing = revisionId && revisionId === previewRevisionId;
                const previewActionId = `${revisionId}:preview`;
                const restoreActionId = `${revisionId}:restore`;
                const deployActionId = `${revisionId}:deploy`;

                return (
                  <article key={revisionId || `${revision.revisionNumber}-${revision.createdAt}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="min-w-0 truncate text-sm font-black text-slate-900 dark:text-white">{getRevisionLabel(revision)}</h4>
                          {revision.isDeployed ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">Live</span>
                          ) : null}
                          {isPreviewing ? (
                            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">Preview</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          Revision {revision.revisionNumber || "?"} | {formatDateTime(revision.createdAt)}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Saved by {revision.createdBy || "unknown"}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onPreview(revision)}
                          disabled={!revisionId || hasAction || loading}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500/15 dark:text-blue-200"
                        >
                          <Icon className="text-[16px]">visibility</Icon>
                          {actionId === previewActionId ? "Loading" : "Preview"}
                        </button>
                        {!previewRevision ? (
                          <button
                            type="button"
                            onClick={() => onRestore(revision)}
                            disabled={!revisionId || hasAction || loading}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-50 px-3 text-xs font-black text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500/15 dark:text-amber-200"
                          >
                            <Icon className="text-[16px]">restore</Icon>
                            {actionId === restoreActionId ? "Restoring" : "Restore"}
                          </button>
                        ) : null}
                        {canDeploy && !previewRevision ? (
                          revision.isDeployed ? (
                            <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-xs font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                              <Icon className="text-[16px]">check_circle</Icon>
                              Deployed
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onDeploy(revision)}
                              disabled={!revisionId || hasAction || loading}
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500/15 dark:text-emerald-200"
                            >
                              <Icon className="text-[16px]">rocket_launch</Icon>
                              {actionId === deployActionId ? "Deploying" : "Deploy"}
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
