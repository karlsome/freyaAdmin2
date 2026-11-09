import { getDefectStatus } from "../utils/statusHelpers";

// ─── Compact per-factory summary row ─────────────────────────────────────────
// Props: factories (byFactory from useTodayData), loading, onNavigateToFactory(name)

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DashboardFactorySummary({ factories, loading, onNavigateToFactory }) {
  const maxTotal = Math.max(...factories.map((f) => f.total), 1);

  if (loading) {
    return (
      <div className="freya-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 18 }}>factory</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Factory Summary</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4 ml-6">Click a row to open factory detail</p>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-[6px] bg-[var(--surface-raised)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="freya-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 18 }}>factory</span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Factory Summary — Today</h3>
        {factories.length > 0 && (
          <span className="ml-auto text-xs text-[var(--text-muted)] font-medium freya-tabular">{factories.length} factories</span>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-4 ml-6">Click a row to open factory detail</p>

      {/* Mobile cards */}
      <div className="space-y-2.5 md:hidden">
        {factories.map((f) => {
          const ds = getDefectStatus(f.defectRate);
          const hasTrouble = f.troubleHours > 0;

          return (
            <button
              key={f.name}
              onClick={() => onNavigateToFactory?.(f.name)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3.5
                         text-left hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)] transition-colors duration-150 group"
            >
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <span className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--freya-blue)] transition-colors">{f.name}</span>
                <span className="material-symbols-outlined text-[var(--text-muted)] group-hover:text-[var(--freya-blue)] transition-colors" style={{ fontSize: 16 }}>
                  chevron_right
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-0.5">Combined</p>
                  <p className="text-sm font-medium text-[var(--text-primary)] freya-tabular">
                    {f.total > 0 ? f.total.toLocaleString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-0.5">Combined NG</p>
                  <p className={`text-sm font-medium freya-tabular ${f.totalNG > 0 ? "text-[var(--semantic-error)] font-semibold" : "text-[var(--text-muted)]"}`}>
                    {f.totalNG > 0 ? f.totalNG.toLocaleString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-0.5">Defect %</p>
                  <p className={`text-sm font-medium freya-tabular ${ds.valueColor}`}>
                    {f.total > 0 ? `${f.defectRate.toFixed(2)}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-0.5">Trouble</p>
                  <p className={`text-sm font-medium freya-tabular ${hasTrouble ? "text-[var(--semantic-warning)] font-semibold" : "text-[var(--text-muted)]"}`}>
                    {hasTrouble ? `${f.troubleHours.toFixed(1)}h` : "—"}
                  </p>
                </div>
              </div>

              <MiniBar
                value={f.total}
                max={maxTotal}
                color={ds.level === "high" ? "bg-[var(--semantic-error)]" : ds.level === "warning" ? "bg-[var(--semantic-warning)]" : "bg-[var(--freya-blue)]"}
              />
            </button>
          );
        })}

        {factories.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-6">No factory data available</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-[8px] border border-[var(--border)]">
        <div className="grid grid-cols-[1fr_96px_96px_96px_80px_130px] gap-3 px-4 py-2.5
                        bg-[var(--surface-raised)] border-b border-[var(--border)]">
          {["Factory", "Combined", "Combined NG", "Defect %", "Trouble", ""].map((h) => (
            <span key={h} className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{h}</span>
          ))}
        </div>

        <div className="divide-y divide-[var(--border)] bg-[var(--surface)]">
          {factories.map((f) => {
            const ds = getDefectStatus(f.defectRate);
            const hasTrouble = f.troubleHours > 0;

            return (
              <button
                key={f.name}
                onClick={() => onNavigateToFactory?.(f.name)}
                className="w-full grid grid-cols-[1fr_96px_96px_96px_80px_130px] gap-3 items-center px-4 py-3
                           text-left hover:bg-[var(--surface-raised)] transition-colors duration-150 group"
              >
                <span className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--freya-blue)] transition-colors truncate">
                  {f.name}
                </span>

                <span className="text-sm font-medium text-[var(--text-primary)] freya-tabular">
                  {f.total > 0 ? f.total.toLocaleString() : <span className="text-[var(--text-muted)] text-xs">—</span>}
                </span>

                <span className={`text-sm font-medium freya-tabular ${f.totalNG > 0 ? "text-[var(--semantic-error)] font-semibold" : "text-[var(--text-muted)]"}`}>
                  {f.totalNG > 0 ? f.totalNG.toLocaleString() : "—"}
                </span>

                <span className={`text-sm font-medium freya-tabular ${ds.valueColor}`}>
                  {f.total > 0 ? `${f.defectRate.toFixed(2)}%` : <span className="text-[var(--text-muted)] text-xs">—</span>}
                </span>

                <span className={`text-sm font-medium freya-tabular ${hasTrouble ? "text-[var(--semantic-warning)] font-semibold" : "text-[var(--text-muted)]"}`}>
                  {hasTrouble ? `${f.troubleHours.toFixed(1)}h` : "—"}
                </span>

                <div className="flex items-center gap-2">
                  <MiniBar value={f.total} max={maxTotal} color={ds.level === "high" ? "bg-[var(--semantic-error)]" : ds.level === "warning" ? "bg-[var(--semantic-warning)]" : "bg-[var(--freya-blue)]"} />
                  <span className="material-symbols-outlined text-[var(--text-muted)] group-hover:text-[var(--freya-blue)] transition-colors flex-shrink-0" style={{ fontSize: 16 }}>
                    chevron_right
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {factories.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-6">No factory data available</p>
        )}
      </div>
    </div>
  );
}
