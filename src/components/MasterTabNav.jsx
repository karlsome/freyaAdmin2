export default function MasterTabNav({ tabs, activeTab, onSelect }) {
  return (
    <div className="glass-card rounded-2xl p-1.5 mb-6">
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const active = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelect(tab)}
              className={[
                "rounded-xl px-4 py-2 text-sm font-bold tracking-tight transition-all duration-200",
                active
                  ? "bg-primary text-on-primary shadow-[0_0_16px_rgba(99,102,241,0.25)]"
                  : tab.ready
                    ? "text-on-surface hover:bg-surface-container"
                    : "text-on-surface-variant/60 hover:bg-surface-container",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}