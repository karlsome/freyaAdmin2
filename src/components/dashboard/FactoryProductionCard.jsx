import { useNavigate } from "react-router-dom";

export default function FactoryProductionCard({ kpis, byFactory = [], byProcess = [], loading, onAskAI, isHighlighted, aiMetadata }) {
  const navigate = useNavigate();
  const dailyTarget = 35000;
  const total = kpis?.total || 0;
  const progressPct = Math.min(100, Math.round((total / dailyTarget) * 100));

  const totalWorkersEstimate = aiMetadata?.activeWorkers?.length || Math.max(1, Math.round((kpis?.workHours || 0) / 7.5));
  const unitsPerLaborHour = kpis?.workHours > 0 ? Math.round(total / kpis.workHours) : 0;

  return (
    <div
      className={`rounded-[8px] bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 shadow-2xs ${
        isHighlighted ? "ring-2 ring-[var(--freya-blue)] ring-offset-2 ring-offset-[var(--page-bg)]" : ""
      }`}
    >
      {/* ── Card Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-[var(--freya-blue-subtle)] border border-[var(--border)] text-[var(--freya-blue)] flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>precision_manufacturing</span>
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">Factory Operations & Attainment</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Live run quantities, lines & worker efficiency</p>
          </div>
        </div>

        {onAskAI && (
          <button
            onClick={() => onAskAI("Analyze current production progress, bottlenecks and worker efficiency")}
            title="Ask AI to analyze production efficiency"
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--freya-blue)] hover:bg-[var(--freya-blue-subtle)] px-2.5 py-1 rounded-[6px] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
            <span>Ask AI</span>
          </button>
        )}
      </div>

      {/* ── Progress bar toward daily goal ── */}
      <div className="p-3.5 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] mb-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-[var(--text-primary)]">
            Daily Production Target: <span className="freya-tabular">{total.toLocaleString()}</span> / {dailyTarget.toLocaleString()} units
          </span>
          <span className="font-bold text-[var(--freya-blue)] freya-tabular">{progressPct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
          <div
            className="h-full bg-[var(--freya-blue)] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mt-2">
          <span>
            Active Personnel: {aiMetadata?.activeWorkers?.length ? (
              <strong className="text-[var(--freya-blue)]">{aiMetadata.activeWorkers.length} verified operators ({aiMetadata.factory})</strong>
            ) : (
              `~${totalWorkersEstimate} operators`
            )}
          </span>
          <span>Efficiency: <strong className="text-[var(--text-primary)] freya-tabular">{unitsPerLaborHour}</strong> units/worker-hr</span>
        </div>
      </div>

      {/* ── Per-Factory Quick Status ── */}
      <div className="mb-4">
        <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-2">
          Facility Breakdown
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {byFactory.map((f) => {
            const hasTrouble = (f.troubleHours || 0) > 0;
            return (
              <div
                key={f.name}
                onClick={() => navigate(`/factory/${encodeURIComponent(f.name)}`)}
                className="p-3 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] cursor-pointer transition-colors flex items-center justify-between gap-3 shadow-2xs"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{f.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">({f.submissionCount || 0} batches)</span>
                  </div>
                  <div className="text-sm font-semibold text-[var(--text-primary)] freya-tabular mt-0.5">
                    {(f.total || 0).toLocaleString()} <span className="text-xs text-[var(--text-muted)] font-normal">units</span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-[4px] border ${
                      f.defectRate >= 2
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : f.defectRate >= 1.5
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    <span>{f.defectRate >= 2 ? "✕" : f.defectRate >= 1.5 ? "▲" : "●"}</span>
                    <span className="freya-tabular">{f.defectRate.toFixed(2)}% NG</span>
                  </span>
                  {hasTrouble && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 block mt-0.5 font-medium">
                      ▲ {f.troubleHours.toFixed(1)}h stoppage
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Per-Process Attainment Strip ── */}
      <div className="pt-3 border-t border-[var(--border)]">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-[var(--text-primary)]">Process Flow Rates</span>
          <span className="text-[var(--text-muted)] text-[11px]">Today</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {byProcess.map((proc) => (
            <div key={proc.name} className="p-2 rounded-[4px] bg-[var(--surface-hover)] text-center">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block">{proc.name}</span>
              <span className="text-xs font-semibold text-[var(--text-primary)] freya-tabular block mt-0.5">
                {(proc.total || 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
