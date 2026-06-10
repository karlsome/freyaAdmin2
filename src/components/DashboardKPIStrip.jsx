// ─── KPI strip shown at the top of the Dashboard ─────────────────────────────
// Props: kpis, byProcess (from useTodayData), loading

import StatSummaryCard from "./StatSummaryCard";

const PROCESS_ACCENT = {
  Kensa: { color: "text-violet-500", bg: "bg-violet-500/10" },
  Press: { color: "text-sky-500",    bg: "bg-sky-500/10"    },
  SRS:   { color: "text-amber-500",  bg: "bg-amber-500/10"  },
  Slit:  { color: "text-emerald-500",bg: "bg-emerald-500/10"},
};

export default function DashboardKPIStrip({ kpis, byProcess = [], loading }) {
  const fmt    = (n) => (loading ? "—" : n.toLocaleString());
  const fmtH   = (h) => (loading ? "—" : `${(h ?? 0).toFixed(1)} h`);
  const fmtPct = (p) => (loading ? "—" : `${(p ?? 0).toFixed(2)}%`);

  const defectColor =
    !loading && kpis.defectRate >= 2.0 ? "text-error bg-error/10" :
    !loading && kpis.defectRate >= 1.5 ? "text-amber-500 bg-amber-500/10" :
                                          "text-emerald-500 bg-emerald-500/10";

  return (
    <div className="space-y-5 mb-8">
      {/* ── Row 1: Overall KPIs ── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-3 flex items-center gap-2">
          <span className="w-3 h-px bg-separator inline-block" />
          Overall
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <StatSummaryCard
            icon="output"
            label="Total Processed"
            value={fmt(kpis.total)}
            subtitle={`${fmt(kpis.submissionCount)} submissions`}
            accent="text-primary bg-primary/10"
            loading={loading}
          />
          <StatSummaryCard
            icon="report"
            label="Total NG"
            value={fmt(kpis.totalNG)}
            subtitle="defective units"
            accent={!loading && kpis.totalNG > 0 ? "text-error bg-error/10" : "text-emerald-500 bg-emerald-500/10"}
            loading={loading}
          />
          <StatSummaryCard
            icon="percent"
            label="Defect Rate"
            value={fmtPct(kpis.defectRate)}
            subtitle={!loading && kpis.defectRate >= 2 ? "Above threshold" : !loading && kpis.defectRate >= 1.5 ? "Near threshold" : "Within target"}
            accent={defectColor}
            loading={loading}
          />
          <StatSummaryCard
            icon="build"
            label="Trouble Time"
            value={fmtH(kpis.troubleHours)}
            subtitle="maintenance downtime"
            accent={!loading && kpis.troubleHours > 1 ? "text-amber-500 bg-amber-500/10" : "text-outline bg-surface-container-high"}
            loading={loading}
          />
        </div>
      </div>

      {/* ── Row 2: Per-process breakdown ── */}
      {byProcess.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-3 flex items-center gap-2">
            <span className="w-3 h-px bg-separator inline-block" />
            By Process
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {byProcess.map((p) => {
              const a = PROCESS_ACCENT[p.name] ?? { color: "text-primary", bg: "bg-primary/10" };
              return (
                <StatSummaryCard
                  key={p.name}
                  icon="precision_manufacturing"
                  label={`${p.name} Process`}
                  value={loading ? "—" : p.total.toLocaleString()}
                  subtitle={loading ? "" : `${p.workHours.toFixed(1)} h · ${p.submissionCount} sub`}
                  accent={`${a.color} ${a.bg}`}
                  loading={loading}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
