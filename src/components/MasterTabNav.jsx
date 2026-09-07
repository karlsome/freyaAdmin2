export default function MasterTabNav({ tabs, activeTab, onSelect }) {
  return (
    <div className="flex flex-wrap items-center p-1 rounded-[6px] bg-[var(--surface-raised)] border border-[var(--border)] mb-6 gap-1">
      {tabs.map((tab) => {
        const active = tab.key === activeTab;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab)}
            className={[
              "whitespace-nowrap rounded-[4px] px-3.5 py-1.5 text-xs font-semibold tracking-normal transition-all duration-150",
              active
                ? "bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] shadow-xs"
                : tab.ready !== false
                  ? "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/60 border border-transparent"
                  : "text-[var(--text-muted)]/50 border border-transparent cursor-not-allowed",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}