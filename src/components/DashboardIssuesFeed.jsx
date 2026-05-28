// ─── Issues feed: records with maintenance or high defect rate ────────────────
// Props: issues (from useTodayData), loading, onRecordClick(record)

import { getDefectRate } from "../utils/statusHelpers";

function IssueTag({ children, color }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
      {children}
    </span>
  );
}

export default function DashboardIssuesFeed({ issues, loading, onRecordClick }) {
  if (loading) {
    return (
      <div className="dashboard-section rounded-2xl p-5 h-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>warning</span>
          </span>
          <h3 className="text-sm font-bold text-on-surface">Issues Today</h3>
        </div>
        <p className="text-[11px] text-outline mb-4 ml-10">Records with maintenance or high defect rate</p>
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-xl bg-surface-container/70 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-section rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>warning</span>
        </span>
        <h3 className="text-sm font-bold text-on-surface">Issues Today</h3>
        {issues.length > 0 && (
          <span className="ml-auto px-2.5 py-1 rounded-full bg-error/12 text-error text-[11px] font-black border border-error/20">
            {issues.length}
          </span>
        )}
      </div>
      <p className="text-[11px] text-outline mb-4 ml-10">Records with maintenance or high defect rate</p>

      {issues.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-emerald-500">
          <span className="w-14 h-14 rounded-2xl bg-emerald-500/8 flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontSize: 32, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </span>
          <div className="text-center">
            <p className="text-sm font-bold">No issues today</p>
            <p className="text-[11px] text-outline mt-0.5">All records within normal range</p>
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
                className={`w-full text-left p-3 rounded-xl border transition-all duration-150
                  bg-surface-container/50 hover:bg-surface-container
                  ${isCritical
                    ? "border-error/25 hover:border-error/45 shadow-[inset_3px_0_0_rgb(var(--c-error))]"
                    : highNg
                      ? "border-error/15 hover:border-error/35 shadow-[inset_3px_0_0_rgba(var(--c-error)/0.6)]"
                      : hasMaint
                        ? "border-amber-500/20 hover:border-amber-500/40 shadow-[inset_3px_0_0_rgba(245,158,11,0.5)]"
                        : "border-separator/40 hover:border-primary/25"
                  }
                `}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-on-surface truncate">{r["工場"]}</span>
                    <span className="text-[10px] text-outline truncate">{r["設備"]}</span>
                  </div>
                  <span className="text-[10px] text-outline flex-shrink-0 bg-surface-container px-1.5 py-0.5 rounded-md">{r["_process"]}</span>
                </div>
                <div className="text-[11px] text-on-surface-variant truncate mb-2">
                  {r["品番"]} · {r["背番号"]} · {r["Worker_Name"]}
                </div>
                <div className="flex flex-wrap gap-2">
                  {highNg && (
                    <IssueTag color="bg-error/12 text-error border border-error/20">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>report</span>
                      {defRate.toFixed(1)}% NG
                    </IssueTag>
                  )}
                  {hasMaint && (
                    <IssueTag color="bg-amber-500/12 text-amber-500 border border-amber-500/20">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>build</span>
                      {Number(r.Total_Trouble_Hours).toFixed(1)} h downtime
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
