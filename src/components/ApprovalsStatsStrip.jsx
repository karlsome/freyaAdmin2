const CARD_DEFS = [
  {
    key: "pending",
    label: "Pending",
    statKey: "pending",
    subtitle: "Awaiting hancho review",
    icon: "schedule",
    accent: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  {
    key: "hancho_approved",
    label: "Hancho Approved",
    statKey: "hanchoApproved",
    subtitle: "Waiting for kacho approval",
    icon: "task_alt",
    accent: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  {
    key: "fully_approved",
    label: "Fully Approved",
    statKey: "fullyApproved",
    subtitle: "Workflow complete",
    icon: "verified",
    accent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "correction_needed",
    label: "Correction Needed",
    statKey: "correctionNeeded",
    subtitle: "Requires edits and resubmission",
    icon: "edit_note",
    accent: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  {
    key: "todayTotal",
    label: "Today Total",
    statKey: "todayTotal",
    subtitle: "Submitted today",
    icon: "today",
    accent: "bg-surface-container-high text-on-surface",
  },
];

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function ApprovalsStatsStrip({ stats, authUser, activeKey = "", onSelect }) {
  const cards = [...CARD_DEFS];

  if (authUser?.role === "班長") {
    cards.splice(4, 0, {
      key: "correction_needed_from_kacho",
      label: "Kacho Requests",
      statKey: "correctionNeededFromKacho",
      subtitle: "Hancho follow-up required",
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
          <button
            key={card.key}
            type="button"
            onClick={() => onSelect?.(card.key)}
            className={joinClasses(
              "glass-card rounded-3xl p-4 text-left transition-transform duration-200 hover:-translate-y-0.5",
              active ? "ring-2 ring-primary/40" : ""
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">{card.label}</div>
                <div className="planner-data-text mt-2 text-3xl font-black text-on-surface tabular-nums">
                  {Number(value).toLocaleString()}
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">{card.subtitle}</p>
              </div>
              <span className={joinClasses("flex h-12 w-12 items-center justify-center rounded-2xl", card.accent)}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>
                  {card.icon}
                </span>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}