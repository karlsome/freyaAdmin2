import { useMemo } from "react";

export default function FinanceOverviewCard({ kpis, byProcess = [], loading, onAskAI, isHighlighted }) {
  // Estimated financial computations based on industrial benchmarks
  // Unit value avg ~¥1,200, Scrap/Defect cost avg ~¥2,800 (material + wasted machine time)
  const stats = useMemo(() => {
    const totalUnits = kpis?.total || 0;
    const ngUnits = kpis?.totalNG || 0;
    const grossValue = totalUnits * 1250;
    const scrapLoss = ngUnits * 2800;
    const materialEfficiency = totalUnits > 0 ? ((totalUnits - ngUnits) / totalUnits) * 100 : 99.5;
    const laborHours = kpis?.workHours || 0;
    const valuePerHour = laborHours > 0 ? Math.round(grossValue / laborHours) : 0;

    return { grossValue, scrapLoss, materialEfficiency, valuePerHour };
  }, [kpis]);

  const fmtYen = (amount) => (loading ? "—" : `¥${amount.toLocaleString()}`);

  return (
    <div
      className={`rounded-[8px] bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 shadow-2xs ${
        isHighlighted ? "ring-2 ring-[var(--freya-blue)] ring-offset-2 ring-offset-[var(--page-bg)]" : ""
      }`}
    >
      {/* ── Card Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span>
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">Financials & Scrap Loss</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Real-time production value & waste cost</p>
          </div>
        </div>

        {onAskAI && (
          <button
            onClick={() => onAskAI("Analyze today's scrap cost and cost optimization opportunities")}
            title="Ask AI to analyze scrap costs"
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--freya-blue)] hover:bg-[var(--freya-blue-subtle)] px-2.5 py-1 rounded-[6px] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
            <span>Ask AI</span>
          </button>
        )}
      </div>

      {/* ── Primary Financial KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-1">
            Gross Value
          </span>
          <span className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 freya-tabular block">
            {fmtYen(stats.grossValue)}
          </span>
          <span className="text-xs text-[var(--text-muted)] mt-0.5 block">Est. output total</span>
        </div>

        <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-1">
            Scrap Cost
          </span>
          <span className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400 freya-tabular block">
            {fmtYen(stats.scrapLoss)}
          </span>
          <span className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 block font-medium">
            ▲ {(kpis?.defectRate || 0).toFixed(2)}% scrap rate
          </span>
        </div>

        <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-1">
            Material Yield
          </span>
          <span className="text-lg sm:text-xl font-bold text-[var(--text-primary)] freya-tabular block">
            {loading ? "—" : `${stats.materialEfficiency.toFixed(1)}%`}
          </span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
            ● Target ≥ 98.0%
          </span>
        </div>

        <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-1">
            Yield / Labor Hr
          </span>
          <span className="text-lg sm:text-xl font-bold text-[var(--text-primary)] freya-tabular block">
            {fmtYen(stats.valuePerHour)}
          </span>
          <span className="text-xs text-[var(--text-muted)] mt-0.5 block">Per active worker hr</span>
        </div>
      </div>

      {/* ── Scrap breakdown by process ── */}
      <div className="pt-3 border-t border-[var(--border)]">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-[var(--text-primary)]">Scrap Cost Allocation by Process</span>
          <span className="text-[var(--text-muted)] text-[11px] freya-tabular">{(kpis?.totalNG || 0).toLocaleString()} NG units</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {byProcess.map((p) => {
            const processNG = p.totalNG || 0;
            const processCost = processNG * 2800;
            const pct = kpis?.totalNG > 0 ? Math.round((processNG / kpis.totalNG) * 100) : 0;
            return (
              <div key={p.name} className="p-2 rounded-[4px] bg-[var(--surface)] border border-[var(--border)]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[var(--text-primary)]">{p.name}</span>
                  <span className="text-[var(--text-muted)]">{pct}%</span>
                </div>
                <span className="text-xs font-semibold text-[var(--text-primary)] freya-tabular block mt-0.5">
                  {fmtYen(processCost)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
