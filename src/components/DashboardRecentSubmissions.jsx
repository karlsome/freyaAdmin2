// ─── Live feed of the most recently submitted records ─────────────────────────
// Props: recent (from useTodayData), loading, onRecordClick(record)

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
      <div className="glass-card rounded-2xl p-5 h-full">
        <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>inbox</span>
          Recent Submissions
        </h3>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-surface-container animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 h-full flex flex-col">
      <h3 className="text-sm font-bold text-on-surface mb-1 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>inbox</span>
        Recent Submissions
      </h3>
      <p className="text-[11px] text-outline mb-4">Latest records submitted today</p>

      {recent.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-outline">
          <span className="material-symbols-outlined" style={{ fontSize: 36 }}>inbox</span>
          <p className="text-sm font-bold">No submissions yet today</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
          {recent.map((r) => {
            const recordTotal = Number(r.Total) || 0;
            const recordNG    = Number(r.Total_NG) || 0;
            const defRate     = recordTotal > 0 ? (recordNG / recordTotal) * 100 : 0;
            const dotColor    = PROCESS_DOT[r._process] ?? "bg-outline";

            return (
              <button
                key={r._id?.$oid ?? `${r["工場"]}-${r["設備"]}-${r.createdAt}`}
                onClick={() => onRecordClick?.(r)}
                className="w-full text-left p-3 rounded-xl bg-surface-container/60 border border-white/5
                           hover:bg-surface-container hover:border-primary/20 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                  <span className="text-xs font-bold text-on-surface truncate flex-1">
                    {r["工場"]} · {r["設備"]}
                  </span>
                  <span className="text-[10px] text-outline flex-shrink-0">{timeAgo(r.createdAt)}</span>
                </div>
                <div className="flex items-center gap-3 pl-4">
                  <span className="text-[11px] text-on-surface-variant truncate flex-1">
                    {r["品番"]} · {r["Worker_Name"]}
                  </span>
                  <span className="text-[11px] font-bold text-on-surface flex-shrink-0">
                    {recordTotal.toLocaleString()}
                    {recordNG > 0 && (
                      <span className={`ml-1.5 ${defRate >= 2 ? "text-error" : "text-outline"}`}>
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
