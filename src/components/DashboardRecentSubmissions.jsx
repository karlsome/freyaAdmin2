// ─── Live feed of the most recently submitted records ─────────────────────────
// Props: recent (from useTodayData), loading, onRecordClick(record)

import { getDefectRate, getProcessedQuantity } from "../utils/statusHelpers";

function timeAgo(isoStr) {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const PROCESS_DOT = {
  Kensa: "bg-violet-500",
  Press: "bg-sky-500",
  SRS:   "bg-amber-500",
  Slit:  "bg-emerald-500",
};

export default function DashboardRecentSubmissions({ recent, loading, onRecordClick }) {
  if (loading) {
    return (
      <div className="freya-card p-5 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 18 }}>inbox</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Submissions</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4 ml-6">Latest records submitted today</p>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[52px] rounded-[6px] bg-[var(--surface-raised)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="freya-card p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 18 }}>inbox</span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Submissions</h3>
        {recent.length > 0 && (
          <span className="ml-auto text-xs freya-tabular text-[var(--text-muted)] font-medium">{recent.length} today</span>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-4 ml-6">Latest records submitted today</p>

      {recent.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)] py-12">
          <span className="w-12 h-12 rounded-[8px] bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>inbox</span>
          </span>
          <p className="text-sm font-medium">No submissions yet today</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
          {recent.map((r) => {
            const recordTotal = getProcessedQuantity(r);
            const recordNG    = Number(r.SRS_Total_NG) || Number(r.Total_NG) || 0;
            const defRate     = getDefectRate(r);
            const dotColor    = PROCESS_DOT[r._process] ?? "bg-[var(--text-muted)]";

            return (
              <button
                key={r._id?.$oid ?? `${r["工場"]}-${r["設備"]}-${r.createdAt}`}
                onClick={() => onRecordClick?.(r)}
                className="w-full text-left px-3.5 py-2.5 rounded-[6px] bg-[var(--surface)] border border-[var(--border)]
                           hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)]
                           transition-colors duration-150 group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate flex-1 group-hover:text-[var(--freya-blue)] transition-colors">
                    {r["工場"]} · {r["設備"]}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] freya-tabular flex-shrink-0">{timeAgo(r.createdAt)}</span>
                </div>
                <div className="flex items-center gap-3 pl-4">
                  <span className="text-xs text-[var(--text-secondary)] truncate flex-1 font-normal">
                    {r["品番"]} · {r["Worker_Name"]}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-primary)] flex-shrink-0 freya-tabular">
                    {recordTotal.toLocaleString()}
                    {recordNG > 0 && (
                      <span className={`ml-1.5 font-semibold ${defRate >= 2 ? "text-[var(--semantic-error)]" : "text-[var(--text-muted)]"}`}>
                        ({recordNG} NG)
                      </span>
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
