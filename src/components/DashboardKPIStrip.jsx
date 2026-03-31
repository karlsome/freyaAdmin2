// ─── KPI strip shown at the top of the Dashboard ─────────────────────────────
// Props: kpis (from useTodayData), loading
export default function DashboardKPIStrip({ kpis, loading }) {
  const fmt    = (n) => (loading ? "—" : n.toLocaleString());
  const fmtH   = (h) => (loading ? "—" : `${h.toFixed(1)} h`);
  const fmtPct = (p) => (loading ? "—" : `${p.toFixed(2)}%`);

  const defectColor =
    !loading && kpis.defectRate >= 2.0 ? "text-error bg-error/10" :
    !loading && kpis.defectRate >= 1.5 ? "text-amber-500 bg-amber-500/10" :
                                          "text-emerald-500 bg-emerald-500/10";

  const tiles = [
    {
      icon:  "output",
      label: "Total Produced",
      value: fmt(kpis.total),
      sub:   `${fmt(kpis.submissionCount)} submissions`,
      accent: "text-primary bg-primary/10",
    },
    {
      icon:  "report",
      label: "Total NG",
      value: fmt(kpis.totalNG),
      sub:   "defective units",
      accent: kpis.totalNG > 0 ? "text-error bg-error/10" : "text-emerald-500 bg-emerald-500/10",
    },
    {
      icon:  "percent",
      label: "Defect Rate",
      value: fmtPct(kpis.defectRate),
      sub:   kpis.defectRate >= 2 ? "Above threshold" : kpis.defectRate >= 1.5 ? "Near threshold" : "Within target",
      accent: defectColor,
    },
    {
      icon:  "schedule",
      label: "Production Hours",
      value: fmtH(kpis.workHours),
      sub:   "total work time",
      accent: "text-sky-500 bg-sky-500/10",
    },
    {
      icon:  "build",
      label: "Trouble Time",
      value: fmtH(kpis.troubleHours),
      sub:   "maintenance downtime",
      accent: kpis.troubleHours > 1 ? "text-amber-500 bg-amber-500/10" : "text-outline bg-surface-container-high",
    },
    {
      icon:  "coffee",
      label: "Break Time",
      value: fmtH(kpis.breakHours),
      sub:   "total break hours",
      accent: "text-outline bg-surface-container-high",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      {tiles.map((t) => (
        <div key={t.label} className="glass-card rounded-2xl p-4 flex flex-col gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${t.accent}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{t.icon}</span>
          </div>
          <div>
            <p className="text-xl font-black text-on-surface leading-none">
              {loading
                ? <span className="inline-block w-16 h-5 rounded bg-surface-container-high animate-pulse" />
                : t.value}
            </p>
            <p className="text-[11px] font-semibold text-on-surface-variant mt-0.5">{t.label}</p>
            <p className="text-[10px] text-outline mt-0.5">{loading ? "" : t.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
