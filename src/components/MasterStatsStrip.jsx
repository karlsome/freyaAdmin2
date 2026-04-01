const STAT_CARDS = [
  {
    key: "totalCount",
    label: "Total Records",
    icon: "database",
    accent: "bg-primary/12 text-primary",
  },
  {
    key: "withImageCount",
    label: "With Image",
    icon: "image",
    accent: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  },
  {
    key: "withoutImageCount",
    label: "Without Image",
    icon: "imagesmode",
    accent: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  },
  {
    key: "filteredCount",
    label: "Visible Now",
    icon: "filter_alt",
    accent: "bg-secondary/15 text-secondary dark:text-secondary",
  },
];

export default function MasterStatsStrip({ stats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
      {STAT_CARDS.map((card) => (
        <div key={card.key} className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>
                {card.icon}
              </span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">{card.label}</div>
              <div className="mt-1 text-2xl font-black text-on-surface">{stats[card.key] ?? 0}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}