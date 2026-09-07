export default function KpiTiles({ data = {}, onAskAI }) {
  const tiles = data.tiles || [];

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${tiles.length >= 4 ? "lg:grid-cols-4" : tiles.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-3.5`}>
        {tiles.map((tile, idx) => {
          const status = tile.status || "ok";
          const isCritical = status === "critical";
          const isWarn = status === "warn";
          const isOk = status === "ok";

          const statusColor = isCritical
            ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
            : isWarn
            ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
            : isOk
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
            : "border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-muted)]";

          return (
            <div
              key={idx}
              className="p-4 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--freya-blue)]/40 transition-all flex flex-col justify-between shadow-2xs gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {tile.label}
                  </span>
                  {tile.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] border ${statusColor}`}>
                      {tile.badge}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] freya-tabular tracking-tight">
                    {tile.value}
                  </span>
                  {tile.unit && (
                    <span className="text-xs font-medium text-[var(--text-muted)]">
                      {tile.unit}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar if present */}
              {typeof tile.progress === "number" && (
                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isCritical ? "bg-rose-500" : isWarn ? "bg-amber-500" : "bg-[var(--freya-blue)]"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, tile.progress))}%` }}
                    />
                  </div>
                  {tile.target && (
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span>{tile.target}</span>
                      <span className="font-semibold freya-tabular">{tile.progress}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Delta footer */}
              {(tile.delta || tile.meta) && (
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-xs">
                  {tile.delta ? (
                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-flex items-center gap-0.5 font-semibold freya-tabular ${
                          tile.deltaDirection === "down" && !isCritical
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                          {tile.deltaDirection === "down" ? "trending_down" : "trending_up"}
                        </span>
                        <span>{tile.delta}</span>
                      </span>
                      {tile.deltaLabel && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {tile.deltaLabel}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div />
                  )}

                  {tile.meta && (
                    <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[140px]">
                      {tile.meta}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onAskAI && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)] font-medium">Actionable inquiries:</span>
          <button
            onClick={() => onAskAI("Explain the primary bottleneck impacting these numbers today")}
            className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>troubleshoot</span>
            <span>Identify bottlenecks</span>
          </button>
          <button
            onClick={() => onAskAI("Show full granular records breakdown")}
            className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>table_view</span>
            <span>View granular table</span>
          </button>
        </div>
      )}
    </div>
  );
}
