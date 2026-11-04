export default function ComparisonPanel({ data = {}, onAskAI }) {
  const entities = data.entities || ["小瀬", "倉知"];
  const metrics = data.metrics || [];

  return (
    <div className="space-y-4">
      {/* ── Metric Comparison Rows ── */}
      <div className="space-y-3.5">
        {metrics.map((metric, idx) => {
          const vals = metric.values || {};
          const v0 = typeof vals[entities[0]] === "number" ? vals[entities[0]] : parseFloat(vals[entities[0]]) || 0;
          const v1 = typeof vals[entities[1]] === "number" ? vals[entities[1]] : parseFloat(vals[entities[1]]) || 0;
          const maxVal = Math.max(v0, v1, 1);

          const pct0 = Math.round((v0 / maxVal) * 100);
          const pct1 = Math.round((v1 / maxVal) * 100);

          const diff = v0 - v1;
          const diffPct = v1 !== 0 ? Math.round(((v0 - v1) / v1) * 100) : 0;

          const higherIsBetter = metric.higherIsBetter !== false;
          const winner = higherIsBetter ? (v0 > v1 ? 0 : v1 > v0 ? 1 : -1) : (v0 < v1 ? 0 : v1 < v0 ? 1 : -1);

          return (
            <div
              key={idx}
              className="p-4 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  {metric.label}
                </span>

                {diff !== 0 && (
                  <span
                    className={`text-[11px] font-semibold freya-tabular px-2 py-0.5 rounded-[4px] border ${
                      (winner === 0 && higherIsBetter) || (winner === 1 && !higherIsBetter)
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-[var(--surface-hover)] text-[var(--text-muted)] border-[var(--border)]"
                    }`}
                  >
                    Delta: {diff > 0 ? `+${diff}` : diff} ({diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`})
                  </span>
                )}
              </div>

              {/* Bar 1: Entity 0 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <span>{entities[0]}</span>
                    {winner === 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                        Lead
                      </span>
                    )}
                  </span>
                  <span className="font-bold freya-tabular text-sm text-[var(--text-primary)]">
                    {vals[entities[0]]} {metric.unit}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      winner === 0 ? "bg-[var(--freya-blue)]" : "bg-slate-400 dark:bg-slate-600"
                    }`}
                    style={{ width: `${pct0}%` }}
                  />
                </div>
              </div>

              {/* Bar 2: Entity 1 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <span>{entities[1]}</span>
                    {winner === 1 && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                        Lead
                      </span>
                    )}
                  </span>
                  <span className="font-bold freya-tabular text-sm text-[var(--text-primary)]">
                    {vals[entities[1]]} {metric.unit}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      winner === 1 ? "bg-[var(--freya-blue)]" : "bg-slate-400 dark:bg-slate-600"
                    }`}
                    style={{ width: `${pct1}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {onAskAI && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)] font-medium">Deep dive:</span>
          <button
            onClick={() => onAskAI(`What is causing the difference between ${entities[0]} and ${entities[1]}?`)}
            className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>analytics</span>
            <span>Analyze variance drivers</span>
          </button>
        </div>
      )}
    </div>
  );
}
