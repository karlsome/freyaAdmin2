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
export default function FactoryCard({ factory, onClick, onDefectClick, onPsaRollClick }) {
  const {
    name,
    total,
    totalNG,
    defectRate,
    topDefects = [],
    isFirstFactory = false,
    totalMeters = 0,
    totalRolls = 0,
    completedRolls = 0,
    inProgressRolls = 0,
    progressRate = 0,
    topRolls = [],
  } = factory;

  // ─── First Factory (PSA Laminating Process) Card ───
  if (isFirstFactory) {
    const psaStatus =
      inProgressRolls > 0
        ? {
            label: "In Operation",
            bg: "bg-emerald-500/10",
            color: "text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
            dot: "bg-emerald-500",
          }
        : completedRolls > 0
        ? {
            label: "Normal",
            bg: "bg-sky-500/10",
            color: "text-sky-600 dark:text-sky-400 border-sky-500/25",
            dot: "bg-sky-500",
          }
        : {
            label: "Standby",
            bg: "bg-[var(--surface-subtle)]",
            color: "text-[var(--text-muted)] border-[var(--border)]",
            dot: "bg-[var(--text-muted)]",
          };

    return (
      <div
        onClick={onClick}
        className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3.5 cursor-pointer shadow-sm hover:border-[var(--border-strong)] transition-all"
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)] leading-tight">{name}</h4>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
              {totalRolls} roll{totalRolls !== 1 ? "s" : ""} ({totalMeters.toLocaleString()} m) today
            </p>
          </div>
          <span className={`flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded-[4px] border ${psaStatus.bg} ${psaStatus.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${psaStatus.dot}`}></span>
            {psaStatus.label}
          </span>
        </div>

        {/* ── Production summary ── */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)]">
          <div>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono mb-0.5">Total</p>
            <p className="text-xs font-bold text-[var(--text-primary)] font-mono">{totalMeters.toLocaleString()} m</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono mb-0.5">Completed</p>
            <p className="text-xs font-bold text-[var(--text-primary)] font-mono">
              {completedRolls} / {totalRolls}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono mb-0.5">Progress</p>
            <p className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">{progressRate}%</p>
          </div>
        </div>

        {/* ── PSA Process Rolls ── */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              PSA Process (Laminating)
            </p>
            {topRolls.length > 0 && (
              <span className="text-[10px] font-mono font-bold text-[var(--freya-blue)] bg-[var(--freya-blue)]/10 border border-[var(--freya-blue)]/20 px-1.5 py-0.5 rounded-[4px]">
                {topRolls.length} roll{topRolls.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {topRolls.length === 0 ? (
            <div className="flex items-center justify-center gap-1.5 rounded-[6px] bg-[var(--surface-subtle)] border border-[var(--border)] py-3 text-xs font-medium text-[var(--text-muted)]">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>layers</span>
              No PSA production today
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Column headers */}
              <div className="grid grid-cols-[1.5rem_1fr_3rem_3rem_3.5rem] gap-x-2 px-1 mb-1">
                <span />
                <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">品番 / 機材</span>
                <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider text-center font-mono">Line</span>
                <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider text-right font-mono">Length</span>
                <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider text-right font-mono">Status</span>
              </div>

              {topRolls.map((roll, i) => {
                const rollStatus = (roll.status || "queue").toLowerCase();
                const isCompleted = rollStatus === "completed";
                const isInProgress = rollStatus === "in-progress" || rollStatus === "active";
                const lengthVal = roll.meters ?? roll.rollMeters ?? 0;

                return (
                  <div
                    key={roll._id || roll.itemId || i}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onPsaRollClick) onPsaRollClick(roll);
                      else if (onClick) onClick();
                    }}
                    className="grid grid-cols-[1.5rem_1fr_3rem_3rem_3.5rem] gap-x-2 items-center px-1 py-1 rounded-[4px] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    {/* Rank badge */}
                    <span className={`text-[9px] font-mono font-bold w-4 h-4 rounded-[4px] flex items-center justify-center ${RANK_COLORS[i] ?? RANK_COLORS[4]}`}>
                      {i + 1}
                    </span>
                    {/* 品番 */}
                    <span className="text-xs font-mono font-bold text-[var(--text-primary)] truncate" title={roll.hinban || roll.kizai}>
                      {roll.labelHinban || roll.hinban || roll.kizai || "—"}
                    </span>
                    {/* Machine */}
                    <span className="text-xs font-mono text-center text-[var(--text-secondary)] truncate">
                      {roll.machine || "PSA2"}
                    </span>
                    {/* Length */}
                    <span className="text-xs font-mono font-medium text-right text-[var(--text-secondary)]">
                      {lengthVal}m
                    </span>
                    {/* Status */}
                    <span
                      className={`text-[10px] font-mono font-bold text-right ${
                        isCompleted
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isInProgress
                          ? "text-amber-500"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      {isCompleted ? "完了" : isInProgress ? "稼働中" : "待機"}
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

  // ─── Standard Factory Card (Inspection / Stamping) ───
  const defectStatus = getDefectStatus(defectRate);

  return (
    <div
      onClick={onClick}
      className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3.5 cursor-pointer shadow-sm hover:border-[var(--border-strong)] transition-all"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-bold text-[var(--text-primary)] leading-tight">{name}</h4>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
            {total.toLocaleString()} kensa units today
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded-[4px] border ${defectStatus.bg} ${defectStatus.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${defectStatus.dot}`}></span>
          {defectStatus.label}
        </span>
      </div>

      {/* ── Production summary ── */}
      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)]">
        <div>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono mb-0.5">Total</p>
          <p className="text-xs font-bold text-[var(--text-primary)] font-mono">{total.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono mb-0.5">NG</p>
          <p className="text-xs font-bold text-[var(--text-primary)] font-mono">{totalNG.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono mb-0.5">Defect</p>
          <p className={`text-xs font-bold font-mono ${defectStatus.valueColor}`}>{defectRate.toFixed(2)}%</p>
        </div>
      </div>

      {/* ── Top defects ── */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
            Top Defects
          </p>
          {topDefects.length > 0 && (
            <span className="text-[10px] font-mono font-bold text-[var(--status-danger)] bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20 px-1.5 py-0.5 rounded-[4px]">
              {topDefects.length} part{topDefects.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {topDefects.length === 0 ? (
          <div className="flex items-center justify-center gap-1.5 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 py-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            No defects today
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Column headers */}
            <div className="grid grid-cols-[1.5rem_1fr_3rem_2.5rem_3.5rem] gap-x-2 px-1 mb-1">
              <span />
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">背番号</span>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider text-right font-mono">Total</span>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider text-right font-mono">NG</span>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider text-right font-mono">Rate</span>
            </div>

            {topDefects.map((d, i) => {
              const rowStatus = getDefectStatus(d.defectRate);
              return (
                <div
                  key={`${d.sebanggo}-${i}`}
                  onClick={(e) => { e.stopPropagation(); if (d.worstRecord && onDefectClick) onDefectClick(d.worstRecord); }}
                  className="grid grid-cols-[1.5rem_1fr_3rem_2.5rem_3.5rem] gap-x-2 items-center px-1 py-1 rounded-[4px] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  {/* Rank badge */}
                  <span className={`text-[9px] font-mono font-bold w-4 h-4 rounded-[4px] flex items-center justify-center ${RANK_COLORS[i] ?? RANK_COLORS[4]}`}>
                    {i + 1}
                  </span>
                  {/* 背番号 */}
                  <span className="text-xs font-mono font-bold text-[var(--text-primary)] truncate">{d.sebanggo}</span>
                  {/* Total */}
                  <span className="text-xs font-mono font-medium text-right text-[var(--text-secondary)]">{d.total.toLocaleString()}</span>
                  {/* NG qty */}
                  <span className="text-xs font-mono font-bold text-right text-error">{d.ng.toLocaleString()}</span>
                  {/* Defect rate */}
                  <span className={`text-xs font-mono font-bold text-right ${rowStatus.valueColor}`}>
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

