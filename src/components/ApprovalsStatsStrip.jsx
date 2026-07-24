import StatSummaryCard from "./StatSummaryCard";

const CARD_DEFS = [
  {
    key: "pending",
    label: "pending",
    statKey: "pending",
    subtitle: "awaitingHanchoReview",
    icon: "schedule",
    accent: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  {
    key: "hancho_approved",
    label: "hanchoApproved",
    statKey: "hanchoApproved",
    subtitle: "waitingForKachoApproval",
    icon: "task_alt",
    accent: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  {
    key: "fully_approved",
    label: "fullyApproved",
    statKey: "fullyApproved",
    subtitle: "workflowComplete",
    icon: "verified",
    accent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "correction_needed",
    label: "correctionNeeded",
    statKey: "correctionNeeded",
    subtitle: "requiresEditsAndResubmission",
    icon: "edit_note",
    accent: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  {
    key: "todayTotal",
    label: "todayTotal",
    statKey: "todayTotal",
    subtitle: "submittedToday",
    icon: "today",
    accent: "bg-surface-container-high text-on-surface",
  },
];

import { useLanguage } from "../contexts/LanguageContext";

export default function ApprovalsStatsStrip({ stats, authUser, activeKey = "", onSelect }) {
  const { t } = useLanguage();
  const cards = [...CARD_DEFS];

  if (authUser?.role === "班長") {
    cards.splice(4, 0, {
      key: "correction_needed_from_kacho",
      label: "kachoRequests",
      statKey: "correctionNeededFromKacho",
      subtitle: "hanchoFollowUpRequired",
      icon: "assignment_late",
      accent: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    });
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-6">
      {cards.map((card) => {
        const value = stats?.[card.statKey] ?? 0;
        const active = activeKey && activeKey === card.key;

        return (
          <StatSummaryCard
            key={card.key}
            icon={card.icon}
            label={t(card.label)}
            value={Number(value).toLocaleString()}
            subtitle={t(card.subtitle)}
            accent={card.accent}
            active={active}
            onClick={() => onSelect?.(card.key)}
          />
        );
      })}
    </div>
  );
}