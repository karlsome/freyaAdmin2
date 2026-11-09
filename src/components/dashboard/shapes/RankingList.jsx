import { useMemo } from "react";

export default function RankingList({ data = {}, onAskAI }) {
  const items = data.items || [];
  const metricLabel = data.metricLabel || "Score";

  // Calculate max numeric value for proportional bar widths
  const maxValue = useMemo(() => {
    let max = 0;
    items.forEach((item) => {
      const num = typeof item.value === "number" ? item.value : parseFloat(item.value);
      if (!isNaN(num) && num > max) max = num;
    });
    return max > 0 ? max : 1;
  }, [items]);

  return (
    <div className="space-y-4">
      {/* ── Podium Top 3 (if 3 or more items) ── */}
      {items.length >= 3 && (
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* Rank 2 (Silver) */}
          <div className="order-1 p-3 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] flex flex-col items-center text-center justify-end shadow-2xs">
            <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs flex items-center justify-center mb-1">
              2
            </span>
            <span className="font-bold text-xs text-[var(--text-primary)] truncate max-w-full">
              {items[1]?.name}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] truncate max-w-full">
              {items[1]?.subtext || items[1]?.factory}
            </span>
            <span className="text-sm font-extrabold text-[var(--text-primary)] freya-tabular mt-1.5">
              {items[1]?.value} <span className="text-[10px] font-normal text-[var(--text-muted)]">{items[1]?.unit}</span>
            </span>
          </div>

          {/* Rank 1 (Gold - Elevated) */}
          <div className="order-2 p-3.5 rounded-[8px] bg-[var(--surface-hover)] border-2 border-amber-500/40 flex flex-col items-center text-center justify-end shadow-xs relative">
            <span className="absolute -top-2.5 px-2 py-0.5 rounded-full bg-amber-500 text-slate-900 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-2xs">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>workspace_premium</span>
              Leader
            </span>
            <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-sm flex items-center justify-center mb-1 mt-1">
              1
            </span>
            <span className="font-extrabold text-sm text-[var(--text-primary)] truncate max-w-full">
              {items[0]?.name}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] truncate max-w-full">
              {items[0]?.subtext || items[0]?.factory}
            </span>
            <span className="text-base font-black text-[var(--freya-blue)] freya-tabular mt-1.5">
              {items[0]?.value} <span className="text-xs font-normal text-[var(--text-muted)]">{items[0]?.unit}</span>
            </span>
          </div>

          {/* Rank 3 (Bronze) */}
          <div className="order-3 p-3 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] flex flex-col items-center text-center justify-end shadow-2xs">
            <span className="w-6 h-6 rounded-full bg-amber-700/20 text-amber-700 dark:text-amber-400 font-extrabold text-xs flex items-center justify-center mb-1">
              3
            </span>
            <span className="font-bold text-xs text-[var(--text-primary)] truncate max-w-full">
              {items[2]?.name}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] truncate max-w-full">
              {items[2]?.subtext || items[2]?.factory}
            </span>
            <span className="text-sm font-extrabold text-[var(--text-primary)] freya-tabular mt-1.5">
              {items[2]?.value} <span className="text-[10px] font-normal text-[var(--text-muted)]">{items[2]?.unit}</span>
            </span>
          </div>
        </div>
      )}

      {/* ── Ranked Full List ── */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {items.map((item, idx) => {
          const rank = item.rank || idx + 1;
          const numValue = typeof item.value === "number" ? item.value : parseFloat(item.value);
          const percent = !isNaN(numValue) ? Math.min(100, Math.max(0, (numValue / maxValue) * 100)) : 50;

          return (
            <div
              key={idx}
              className="p-2.5 sm:p-3 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all relative overflow-hidden flex items-center justify-between gap-3 shadow-2xs"
            >
              {/* Proportional background bar */}
              <div
                className="absolute inset-y-0 left-0 bg-[var(--surface-hover)] opacity-60 pointer-events-none transition-all duration-500"
                style={{ width: `${percent}%` }}
              />

              {/* Left Rank & Entity */}
              <div className="relative z-10 flex items-center gap-3 min-w-0">
                <span
                  className={`w-6 h-6 rounded-[4px] flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 ${
                    rank === 1
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                      : rank === 2
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      : rank === 3
                      ? "bg-amber-700/15 text-amber-700 dark:text-amber-500"
                      : "bg-[var(--surface-hover)] text-[var(--text-muted)]"
                  }`}
                >
                  {rank}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] truncate">
                      {item.name}
                    </span>
                    {item.factory && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border)]">
                        {item.factory}
                      </span>
                    )}
                  </div>
                  {item.subtext && (
                    <span className="text-[11px] text-[var(--text-muted)] block truncate">
                      {item.subtext}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Metric Value */}
              <div className="relative z-10 text-right flex-shrink-0">
                <span className="text-sm sm:text-base font-bold text-[var(--text-primary)] freya-tabular">
                  {item.value}
                </span>
                {item.unit && (
                  <span className="text-[11px] font-medium text-[var(--text-muted)] ml-1">
                    {item.unit}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {onAskAI && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)] font-medium">Follow-up:</span>
          <button
            onClick={() => onAskAI(`Compare performance between ${items[0]?.name || "leader"} and other stations`)}
            className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>compare_arrows</span>
            <span>Compare with leader</span>
          </button>
        </div>
      )}
    </div>
  );
}
