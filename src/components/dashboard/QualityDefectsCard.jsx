import { getDefectStatus } from "../../utils/statusHelpers";

export default function QualityDefectsCard({ kpis, issues = [], byProcess = [], onRecordClick, onAskAI, isHighlighted }) {
  const defectRate = kpis?.defectRate || 0;
  const defStatus = getDefectStatus(defectRate);
  const totalNG = kpis?.totalNG || 0;

  // Filter top defect records
  const defectIssues = issues.filter(
    (r) => (Number(r.SRS_Total_NG) || Number(r.Total_NG) || 0) > 0
  ).slice(0, 4);

  return (
    <div
      className={`rounded-[8px] bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 shadow-2xs ${
        isHighlighted ? "ring-2 ring-[var(--freya-blue)] ring-offset-2 ring-offset-[var(--page-bg)]" : ""
      }`}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>report_problem</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">Quality & Defect Diagnostics</h3>
              <span
                className={`freya-badge ${
                  defStatus.level === "normal"
                    ? "freya-badge-normal"
                    : defStatus.level === "warning"
                    ? "freya-badge-warning"
                    : "freya-badge-defect"
                }`}
              >
                <span className="freya-badge-dot" />
                {defStatus.label}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Real-time scrap rate and non-conformance</p>
          </div>
        </div>

        {onAskAI && (
          <button
            onClick={() => onAskAI("Investigate defect spikes, root causes, and inspection anomalies")}
            title="Ask AI to analyze defects"
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--freya-blue)] hover:bg-[var(--freya-blue-subtle)] px-2.5 py-1 rounded-[6px] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
            <span>Ask AI</span>
          </button>
        )}
      </div>

      {/* ── Primary Quality KPIs ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3.5 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-1">
            Overall Defect Rate
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl sm:text-2xl font-bold freya-tabular ${
              defectRate >= 2 ? "text-rose-600 dark:text-rose-400" : defectRate >= 1.5 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
            }`}>
              {defectRate.toFixed(2)}%
            </span>
            <span className="text-xs text-[var(--text-muted)] font-normal">threshold 1.50%</span>
          </div>
        </div>

        <div className="p-3.5 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-1">
            Total NG Units
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 freya-tabular">
              {totalNG.toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-normal">units rejected</span>
          </div>
        </div>
      </div>

      {/* ── Defect Alerts List ── */}
      <div className="mb-4">
        <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-2">
          Prioritized Defect Issues
        </span>
        {defectIssues.length === 0 ? (
          <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] text-center text-xs text-[var(--text-muted)]">
            ● Zero critical defect anomalies detected today.
          </div>
        ) : (
          <div className="space-y-1.5">
            {defectIssues.map((r, idx) => {
              const ng = Number(r.SRS_Total_NG) || Number(r.Total_NG) || 0;
              const hinban = r["品番"] || r.Hinban || "—";
              const factory = r["工場"] || "—";
              return (
                <div
                  key={r.id || idx}
                  onClick={() => onRecordClick && onRecordClick(r, r._process || "Kensa")}
                  className="p-2.5 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] cursor-pointer transition-colors flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{hinban}</span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">({factory} · {r._process || "Line"})</span>
                  </div>
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 freya-tabular flex-shrink-0">
                    ✕ +{ng} NG
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Process Defect Distribution ── */}
      <div className="pt-3 border-t border-[var(--border)]">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-[var(--text-primary)]">Defects by Process</span>
          <span className="text-[var(--text-muted)] text-[11px]">Today</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {byProcess.map((p) => {
            const ng = p.totalNG || 0;
            const rate = p.total > 0 ? (ng / p.total) * 100 : 0;
            return (
              <div key={p.name} className="p-2 rounded-[4px] bg-[var(--surface-hover)] text-center">
                <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block">{p.name}</span>
                <span className={`text-xs font-semibold freya-tabular block mt-0.5 ${rate >= 2 ? "text-rose-500" : "text-[var(--text-primary)]"}`}>
                  {ng} <span className="text-[9px] text-[var(--text-muted)] font-normal">({rate.toFixed(1)}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
