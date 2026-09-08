import StatSummaryCard from "./StatSummaryCard";
import { useLanguage } from "../contexts/LanguageContext";

const STAT_CARDS = [
  {
    key: "totalCount",
    label: "Total Records",
    labelJa: "総レコード数",
    subtitle: "all master entries",
    subtitleJa: "登録済みの全マスターデータ",
    icon: "database",
    accent: "bg-primary/12 text-primary",
  },
  {
    key: "withImageCount",
    label: "With Image",
    labelJa: "画像あり",
    subtitle: "records with image assets",
    subtitleJa: "画像登録済みレコード",
    icon: "image",
    accent: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  },
  {
    key: "withoutImageCount",
    label: "Without Image",
    labelJa: "画像なし",
    subtitle: "records missing image assets",
    subtitleJa: "画像未登録レコード",
    icon: "imagesmode",
    accent: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  },
  {
    key: "filteredCount",
    label: "Visible Now",
    labelJa: "表示中",
    subtitle: "records after active filters",
    subtitleJa: "フィルター適用後の表示件数",
    icon: "filter_alt",
    accent: "bg-secondary/15 text-secondary dark:text-secondary",
  },
];

export default function MasterStatsStrip({ stats }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
      {STAT_CARDS.map((card) => (
        <StatSummaryCard
          key={card.key}
          variant="freya"
          icon={card.icon}
          label={isJa ? card.labelJa : card.label}
          value={Number(stats[card.key] ?? 0).toLocaleString()}
          subtitle={isJa ? card.subtitleJa : card.subtitle}
          accent={card.accent}
        />
      ))}
    </div>
  );
}