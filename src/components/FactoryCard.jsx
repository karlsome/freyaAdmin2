import { getDefectStatus } from "../utils/statusHelpers";

// ─── Rank badge ───────────────────────────────────────────────────────────────
const RANK_COLORS = [
  "bg-error/15 text-error",
  "bg-amber-500/15 text-amber-500",
  "bg-amber-400/10 text-amber-400",
  "bg-surface-container text-outline",
  "bg-surface-container text-outline",
];

// ─── Main card ────────────────────────────────────────────────────────────────
export default function FactoryCard({ factory, onClick }) {
  const { name, total, totalNG, defectRate, topDefects = [] } = factory;
  const defectStatus = getDefectStatus(defectRate);

  return (
    <div
      onClick={onClick}
      className="glass-card rounded-2xl p-5 flex flex-col gap-4 cursor-pointer hover:shadow-xl hover:shadow-primary/5 hover:scale-[1.02] transition-all duration-300"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-base font-bold text-on-surface leading-tight">{name}</h4>
          <p className="text-[10px] text-on-surface-variant mt-0.5">
            {total.toLocaleString()} kensa units today
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${defectStatus.bg} ${defectStatus.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${defectStatus.dot}`}></span>
          {defectStatus.label}
        </span>
      </div>

      {/* ── Production summary ── */}
      <div className="grid grid-cols-3 gap-2 pb-3 border-b border-outline-variant/20">
        <div>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Total</p>
          <p className="text-sm font-black text-on-surface">{total.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">NG</p>
          <p className="text-sm font-black text-on-surface">{totalNG.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Defect</p>
          <p className={`text-sm font-black ${defectStatus.valueColor}`}>{defectRate.toFixed(2)}%</p>
        </div>
      </div>

      {/* ── Top defects ── */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            Top Defects
          </p>
          {topDefects.length > 0 && (
            <span className="text-[10px] font-bold text-error bg-error/10 px-2 py-0.5 rounded-full">
              {topDefects.length} part{topDefects.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {topDefects.length === 0 ? (
          <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 py-4 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            No defects today
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Column headers */}
            <div className="grid grid-cols-[1.5rem_1fr_3rem_3.5rem] gap-x-2 px-1 mb-1">
              <span />
              <span className="text-[9px] font-bold text-outline uppercase tracking-widest">背番号</span>
              <span className="text-[9px] font-bold text-outline uppercase tracking-widest text-right">NG</span>
              <span className="text-[9px] font-bold text-outline uppercase tracking-widest text-right">Rate</span>
            </div>

            {topDefects.map((d, i) => {
              const rowStatus = getDefectStatus(d.defectRate);
              return (
                <div
                  key={`${d.sebanggo}-${i}`}
                  className="grid grid-cols-[1.5rem_1fr_3rem_3.5rem] gap-x-2 items-center px-1 py-1.5 rounded-lg hover:bg-primary/10 hover:shadow-[inset_3px_0_0_rgb(var(--c-primary))] transition-all duration-150"
                >
                  {/* Rank badge */}
                  <span className={`text-[9px] font-black w-5 h-5 rounded-md flex items-center justify-center ${RANK_COLORS[i] ?? RANK_COLORS[4]}`}>
                    {i + 1}
                  </span>
                  {/* 背番号 */}
                  <span className="text-xs font-mono text-on-surface truncate">{d.sebanggo}</span>
                  {/* NG qty */}
                  <span className="text-xs font-bold text-right text-error">{d.ng.toLocaleString()}</span>
                  {/* Defect rate */}
                  <span className={`text-xs font-bold text-right ${rowStatus.valueColor}`}>
                    {d.defectRate.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

