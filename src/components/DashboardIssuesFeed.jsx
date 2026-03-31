// ─── Issues feed: records with maintenance or high defect rate ────────────────
// Props: issues (from useTodayData), loading, onRecordClick(record)

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
      <div className="glass-card rounded-2xl p-5 h-full">
        <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>warning</span>
          Issues Today
        </h3>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-surface-container animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 h-full flex flex-col">
      <h3 className="text-sm font-bold text-on-surface mb-1 flex items-center gap-2">
        <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>warning</span>
        Issues Today
        {issues.length > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-error/15 text-error text-[10px] font-bold">
            {issues.length}
          </span>
        )}
      </h3>
      <p className="text-[11px] text-outline mb-4">Records with maintenance or high defect rate</p>

      {issues.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-emerald-500">
          <span className="material-symbols-outlined" style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p className="text-sm font-bold">No issues today</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
          {issues.map((r) => {
            const recordTotal = Number(r.Total) || 0;
            const recordNG    = Number(r.Total_NG) || 0;
            const defRate     = recordTotal > 0 ? (recordNG / recordTotal) * 100 : 0;
            const hasMaint    = Number(r.Total_Trouble_Hours) > 0;
            const highNg      = defRate >= 2;

            return (
              <button
                key={r._id?.$oid ?? `${r["工場"]}-${r["設備"]}-${r.Date}`}
                onClick={() => onRecordClick?.(r)}
                className="w-full text-left p-3 rounded-xl bg-surface-container/60 border border-white/5
                           hover:bg-surface-container hover:border-primary/20 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-on-surface truncate">{r["工場"]}</span>
                    <span className="text-[10px] text-outline truncate">{r["設備"]}</span>
                  </div>
                  <span className="text-[10px] text-outline flex-shrink-0">{r["_process"]}</span>
                </div>
                <div className="text-[11px] text-on-surface-variant truncate mb-1.5">
                  {r["品番"]} · {r["背番号"]} · {r["Worker_Name"]}
                </div>
                <div className="flex flex-wrap gap-1">
                  {highNg && (
                    <IssueTag color="bg-error/15 text-error">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>report</span>
                      {defRate.toFixed(1)}% NG
                    </IssueTag>
                  )}
                  {hasMaint && (
                    <IssueTag color="bg-amber-500/15 text-amber-500">
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
