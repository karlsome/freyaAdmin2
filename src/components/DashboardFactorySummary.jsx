import { getDefectStatus } from "../utils/statusHelpers";

// ─── Compact per-factory summary row ─────────────────────────────────────────
// Props: factories (byFactory from useTodayData), loading, onNavigateToFactory(name)

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DashboardFactorySummary({ factories, loading, onNavigateToFactory }) {
  const maxTotal = Math.max(...factories.map((f) => f.total), 1);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>factory</span>
          Factory Summary
        </h3>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-surface-container animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-bold text-on-surface mb-1 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>factory</span>
        Factory Summary — Today
      </h3>
      <p className="text-[11px] text-outline mb-4">Click a row to open factory detail</p>

      <div className="space-y-1.5">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px_80px_56px_120px] gap-3 px-3 pb-1 border-b border-white/5">
          {["Factory", "Combined", "Combined NG", "Defect %", "Trouble", ""].map((h) => (
            <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-outline">{h}</span>
          ))}
        </div>

        {factories.map((f) => {
          const ds = getDefectStatus(f.defectRate);
          const hasTrouble = f.troubleHours > 0;

          return (
            <button
              key={f.name}
              onClick={() => onNavigateToFactory?.(f.name)}
              className="w-full grid grid-cols-[1fr_80px_80px_80px_56px_120px] gap-3 items-center px-3 py-2.5
                         rounded-xl text-left hover:bg-primary/10 hover:shadow-[inset_3px_0_0_rgb(var(--c-primary))] transition-all duration-150 group"
            >
              {/* Name */}
              <span className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                {f.name}
              </span>

              {/* Produced */}
              <span className="text-sm font-bold text-on-surface tabular-nums">
                {f.total > 0 ? f.total.toLocaleString() : <span className="text-outline text-xs">—</span>}
              </span>

              {/* NG */}
              <span className={`text-sm font-bold tabular-nums ${f.totalNG > 0 ? "text-error" : "text-outline"}`}>
                {f.totalNG > 0 ? f.totalNG.toLocaleString() : "—"}
              </span>

              {/* Defect % */}
              <span className={`text-sm font-bold tabular-nums ${ds.valueColor}`}>
                {f.total > 0 ? `${f.defectRate.toFixed(2)}%` : <span className="text-outline text-xs">—</span>}
              </span>

              {/* Trouble */}
              <span className={`text-sm font-bold tabular-nums ${hasTrouble ? "text-amber-500" : "text-outline"}`}>
                {hasTrouble ? `${f.troubleHours.toFixed(1)}h` : "—"}
              </span>

              {/* Mini bar + arrow */}
              <div className="flex items-center gap-2">
                <MiniBar value={f.total} max={maxTotal} color={ds.level === "high" ? "bg-error" : ds.level === "warning" ? "bg-amber-500" : "bg-primary"} />
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors" style={{ fontSize: 14 }}>
                  chevron_right
                </span>
              </div>
            </button>
          );
        })}

        {factories.length === 0 && (
          <p className="text-sm text-outline text-center py-6">No factory data available</p>
        )}
      </div>
    </div>
  );
}
