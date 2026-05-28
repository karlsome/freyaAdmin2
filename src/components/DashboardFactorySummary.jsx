import { getDefectStatus } from "../utils/statusHelpers";

// ─── Compact per-factory summary row ─────────────────────────────────────────
// Props: factories (byFactory from useTodayData), loading, onNavigateToFactory(name)

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2 rounded-full bg-surface-container-high overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DashboardFactorySummary({ factories, loading, onNavigateToFactory }) {
  const maxTotal = Math.max(...factories.map((f) => f.total), 1);

  if (loading) {
    return (
      <div className="dashboard-section rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>factory</span>
          </span>
          <h3 className="text-sm font-bold text-on-surface">Factory Summary</h3>
        </div>
        <p className="text-[11px] text-outline mb-4 ml-10">Click a row to open factory detail</p>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-surface-container/70 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-section rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>factory</span>
        </span>
        <h3 className="text-sm font-bold text-on-surface">Factory Summary — Today</h3>
        {factories.length > 0 && (
          <span className="ml-auto text-[10px] text-outline">{factories.length} factories</span>
        )}
      </div>
      <p className="text-[11px] text-outline mb-4 ml-10">Click a row to open factory detail</p>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {factories.map((f) => {
          const ds = getDefectStatus(f.defectRate);
          const hasTrouble = f.troubleHours > 0;

          return (
            <button
              key={f.name}
              onClick={() => onNavigateToFactory?.(f.name)}
              className="w-full rounded-xl border border-separator/50 bg-surface-container/40 p-4
                         text-left hover:bg-primary/8 hover:border-primary/30 transition-all duration-150 group"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{f.name}</span>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors" style={{ fontSize: 16 }}>
                  chevron_right
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-0.5">Combined</p>
                  <p className="text-sm font-bold text-on-surface tabular-nums">
                    {f.total > 0 ? f.total.toLocaleString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-0.5">Combined NG</p>
                  <p className={`text-sm font-bold tabular-nums ${f.totalNG > 0 ? "text-error" : "text-outline"}`}>
                    {f.totalNG > 0 ? f.totalNG.toLocaleString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-0.5">Defect %</p>
                  <p className={`text-sm font-bold tabular-nums ${ds.valueColor}`}>
                    {f.total > 0 ? `${f.defectRate.toFixed(2)}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-0.5">Trouble</p>
                  <p className={`text-sm font-bold tabular-nums ${hasTrouble ? "text-amber-500" : "text-outline"}`}>
                    {hasTrouble ? `${f.troubleHours.toFixed(1)}h` : "—"}
                  </p>
                </div>
              </div>

              <MiniBar
                value={f.total}
                max={maxTotal}
                color={ds.level === "high" ? "bg-error" : ds.level === "warning" ? "bg-amber-500" : "bg-primary"}
              />
            </button>
          );
        })}

        {factories.length === 0 && (
          <p className="text-sm text-outline text-center py-8">No factory data available</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[1fr_88px_88px_80px_60px_130px] gap-3 px-3 py-3
                        rounded-xl bg-surface-container-high/40 border border-separator/30 mb-2">
          {["Factory", "Combined", "Combined NG", "Defect %", "Trouble", ""].map((h) => (
            <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-outline">{h}</span>
          ))}
        </div>

        <div className="space-y-1">
          {factories.map((f) => {
            const ds = getDefectStatus(f.defectRate);
            const hasTrouble = f.troubleHours > 0;

            return (
              <button
                key={f.name}
                onClick={() => onNavigateToFactory?.(f.name)}
                className="w-full grid grid-cols-[1fr_88px_88px_80px_60px_130px] gap-3 items-center px-3 py-3
                           rounded-xl text-left hover:bg-primary/8 hover:shadow-[inset_3px_0_0_rgb(var(--c-primary))]
                           border border-transparent hover:border-primary/15 transition-all duration-150 group"
              >
                <span className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                  {f.name}
                </span>

                <span className="text-sm font-bold text-on-surface tabular-nums">
                  {f.total > 0 ? f.total.toLocaleString() : <span className="text-outline text-xs">—</span>}
                </span>

                <span className={`text-sm font-bold tabular-nums ${f.totalNG > 0 ? "text-error" : "text-outline"}`}>
                  {f.totalNG > 0 ? f.totalNG.toLocaleString() : "—"}
                </span>

                <span className={`text-sm font-bold tabular-nums ${ds.valueColor}`}>
                  {f.total > 0 ? `${f.defectRate.toFixed(2)}%` : <span className="text-outline text-xs">—</span>}
                </span>

                <span className={`text-sm font-bold tabular-nums ${hasTrouble ? "text-amber-500" : "text-outline"}`}>
                  {hasTrouble ? `${f.troubleHours.toFixed(1)}h` : "—"}
                </span>

                <div className="flex items-center gap-2">
                  <MiniBar value={f.total} max={maxTotal} color={ds.level === "high" ? "bg-error" : ds.level === "warning" ? "bg-amber-500" : "bg-primary"} />
                  <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors flex-shrink-0" style={{ fontSize: 14 }}>
                    chevron_right
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {factories.length === 0 && (
          <p className="text-sm text-outline text-center py-8">No factory data available</p>
        )}
      </div>
    </div>
  );
}
