// ─── Issues feed: records with maintenance or high defect rate ────────────────
// Props: issues (from useTodayData), loading, onRecordClick(record)

import { getDefectRate } from "../utils/statusHelpers";

function IssueTag({ children, color }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
      {children}
    </span>
  );
}

export default function DashboardIssuesFeed({ issues, loading, onRecordClick }) {
  if (loading) {
    return (
      <div className="freya-card p-5 h-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-8 h-8 rounded-[6px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>
          </span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Issues Today</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4 ml-10">Records requiring maintenance or showing high defect rates</p>
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-[6px] bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="freya-card p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-[6px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>
        </span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Issues Today</h3>
        {issues.length > 0 && (
          <span className="ml-auto freya-badge freya-badge-defect">
            <span className="freya-badge-dot" />
            {issues.length} {issues.length === 1 ? "Issue" : "Issues"}
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-4 ml-10">Records requiring maintenance or showing high defect rates</p>

      {issues.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400 py-8">
          <span className="w-12 h-12 rounded-[8px] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontSize: 26, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </span>
          <div className="text-center">
            <p className="text-sm font-semibold text-[var(--text-primary)]">No issues today</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">All production lines within tolerance</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2.5">
          {issues.map((r, idx) => {
            const defRate     = getDefectRate(r);
            const hasMaint    = Number(r.Total_Trouble_Hours) > 0;
            const highNg      = defRate >= 2;
            const isCritical  = highNg && defRate >= 5;

            return (
              <button
                key={r._id?.$oid ?? `${r["工場"]}-${r["設備"]}-${r.Date}-${idx}`}
                onClick={() => onRecordClick?.(r)}
                className={`w-full text-left p-3 rounded-[6px] border transition-all duration-150
                  bg-[var(--surface)] hover:bg-[var(--surface-hover)]
                  ${isCritical
                    ? "border-rose-300 dark:border-rose-800 shadow-[inset_3px_0_0_#DC2626]"
                    : highNg
                      ? "border-rose-200 dark:border-rose-900 shadow-[inset_3px_0_0_#DC2626]"
                      : hasMaint
                        ? "border-amber-200 dark:border-amber-900 shadow-[inset_3px_0_0_#D97706]"
                        : "border-[var(--border)] hover:border-slate-300 dark:hover:border-slate-700"
                  }
                `}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{r["工場"]}</span>
                    <span className="text-[11px] text-[var(--text-muted)] truncate">{r["設備"]}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] flex-shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-[4px]">{r["_process"]}</span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] truncate mb-2">
                  {r["品番"]} · {r["背番号"]} · {r["Worker_Name"]}
                </div>
                <div className="flex flex-wrap gap-2">
                  {highNg && (
                    <IssueTag color="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>report</span>
                      <span className="freya-tabular">{defRate.toFixed(1)}% NG</span>
                    </IssueTag>
                  )}
                  {hasMaint && (
                    <IssueTag color="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>build</span>
                      <span className="freya-tabular">{Number(r.Total_Trouble_Hours).toFixed(1)} h downtime</span>
                    </IssueTag>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
