import StatSummaryCard from "./StatSummaryCard";

const STAT_CARDS = [
  {
    key: "totalCount",
    label: "Total Records",
    subtitle: "all master entries",
    icon: "database",
    accent: "bg-primary/12 text-primary",
  },
  {
    key: "withImageCount",
    label: "With Image",
    subtitle: "records with image assets",
    icon: "image",
    accent: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  },
  {
    key: "withoutImageCount",
    label: "Without Image",
    subtitle: "records missing image assets",
    icon: "imagesmode",
    accent: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  },
  {
    key: "filteredCount",
    label: "Visible Now",
    subtitle: "records after active filters",
    icon: "filter_alt",
    accent: "bg-secondary/15 text-secondary dark:text-secondary",
  },
];

export default function MasterStatsStrip({ stats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
      {STAT_CARDS.map((card) => (
        <StatSummaryCard
          key={card.key}
          icon={card.icon}
          label={card.label}
          value={Number(stats[card.key] ?? 0).toLocaleString()}
          subtitle={card.subtitle}
          accent={card.accent}
        />
      ))}
    </div>
  );
}