import StatSummaryCard from "./StatSummaryCard";
import { useLanguage } from "../contexts/LanguageContext";

const CARD_DEFS = [
  {
    key: "pending",
    label: "Pending",
    labelJa: "未承認",
    statKey: "pending",
    subtitle: "Awaiting hancho review",
    subtitleJa: "班長の確認待ち",
    icon: "schedule",
    accent: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  {
    key: "hancho_approved",
    label: "Hancho Approved",
    labelJa: "班長承認済",
    statKey: "hanchoApproved",
    subtitle: "Waiting for kacho approval",
    subtitleJa: "課長/部長の承認待ち",
    icon: "task_alt",
    accent: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  {
    key: "fully_approved",
    label: "Fully Approved",
    labelJa: "最終承認済",
    statKey: "fullyApproved",
    subtitle: "Workflow complete",
    subtitleJa: "承認完了",
    icon: "verified",
    accent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "correction_needed",
    label: "Correction Needed",
    labelJa: "差戻し（修正待ち）",
    statKey: "correctionNeeded",
    subtitle: "Requires edits and resubmission",
    subtitleJa: "修正および再提出が必要",
    icon: "edit_note",
    accent: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  {
    key: "todayTotal",
    label: "Today Total",
    labelJa: "本日の提出件数",
    statKey: "todayTotal",
    subtitle: "Submitted today",
    subtitleJa: "本日登録された実績",
    icon: "today",
    accent: "bg-surface-container-high text-on-surface",
  },
];

export default function ApprovalsStatsStrip({ stats, authUser, activeKey = "", onSelect }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const cards = [...CARD_DEFS];

  if (authUser?.role === "班長") {
    cards.splice(4, 0, {
      key: "correction_needed_from_kacho",
      label: "Kacho Requests",
      labelJa: "課長差戻し",
      statKey: "correctionNeededFromKacho",
      subtitle: "Hancho follow-up required",
      subtitleJa: "班長のフォローが必要",
      icon: "assignment_late",
      accent: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-6">
      {cards.map((card) => {
        const value = stats?.[card.statKey] ?? 0;
        const active = activeKey && activeKey === card.key;

        return (
          <StatSummaryCard
            key={card.key}
            variant="freya"
            icon={card.icon}
            label={isJa ? card.labelJa : card.label}
            value={Number(value).toLocaleString()}
            subtitle={isJa ? card.subtitleJa : card.subtitle}
            active={active}
            onClick={() => onSelect?.(card.key)}
          />
        );
      })}
    </div>
  );
}