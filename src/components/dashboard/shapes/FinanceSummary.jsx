export default function FinanceSummary({ data = {}, onAskAI }) {
  const kpis = data.kpis || [
    { label: "Estimated Gross Output", value: "¥1,850,000", status: "ok", badge: "Revenue" },
    { label: "Scrap & NG Loss", value: "-¥42,800", status: "critical", badge: "Waste Cost" },
    { label: "Labor Incurred", value: "¥320,000", status: "ok", badge: "Direct Labor" },
    { label: "Est. Operating Margin", value: "78.4%", status: "ok", badge: "Gross Margin" }
  ];

  const categories = data.categories || [
    { name: "Kensa Final Inspection", revenue: "¥920,000", scrap: "¥18,000", share: "49.7%", margin: "80.2%" },
    { name: "Press Stamping Lines", revenue: "¥640,000", scrap: "¥19,400", share: "34.6%", margin: "74.8%" },
    { name: "Slit & SRS Processing", revenue: "¥290,000", scrap: "¥5,400", share: "15.7%", margin: "82.1%" }
  ];

  return (
    <div className="space-y-4">
      {/* ── Headline Financial KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, idx) => {
          const isCritical = kpi.status === "critical";
          const isOk = kpi.status === "ok";

          return (
            <div
              key={idx}
              className="p-4 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] shadow-2xs flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  {kpi.label}
                </span>
                {kpi.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] border ${
                      isCritical
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {kpi.badge}
                  </span>
                )}
              </div>

              <div
                className={`text-2xl font-extrabold freya-tabular ${
                  isCritical ? "text-rose-600 dark:text-rose-400" : isOk ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]"
                }`}
              >
                {kpi.value}
              </div>

              {kpi.meta && (
                <div className="text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
                  {kpi.meta}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Category Breakdown Table ── */}
      <div className="p-4 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] shadow-2xs space-y-3">
        <span className="text-xs font-bold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
          Process Contribution & Waste Analysis
        </span>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-[11px] uppercase tracking-[0.04em]">
                <th className="py-2 px-2.5 font-semibold">Manufacturing Process</th>
                <th className="py-2 px-2.5 font-semibold text-right">Output Value</th>
                <th className="py-2 px-2.5 font-semibold text-right">Scrap Loss</th>
                <th className="py-2 px-2.5 font-semibold text-right">Volume Share</th>
                <th className="py-2 px-2.5 font-semibold text-right">Est. Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
              {categories.map((c, idx) => (
                <tr key={idx} className="hover:bg-[var(--surface-hover)] transition-colors">
                  <td className="py-2.5 px-2.5 font-semibold">{c.name}</td>
                  <td className="py-2.5 px-2.5 text-right font-bold freya-tabular">{c.revenue}</td>
                  <td className="py-2.5 px-2.5 text-right font-semibold freya-tabular text-rose-600 dark:text-rose-400">
                    {c.scrap}
                  </td>
                  <td className="py-2.5 px-2.5 text-right freya-tabular text-[var(--text-muted)]">{c.share}</td>
                  <td className="py-2.5 px-2.5 text-right font-bold freya-tabular text-emerald-600 dark:text-emerald-400">
                    {c.margin}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {onAskAI && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)] font-medium">Financial follow-ups:</span>
          <button
            onClick={() => onAskAI("Which products are responsible for the ¥42,800 scrap loss today?")}
            className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_forever</span>
            <span>Identify scrap cost drivers</span>
          </button>
        </div>
      )}
    </div>
  );
}
