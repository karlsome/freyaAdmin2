const pageLabels = {
  factories: { icon: "factory", label: "Factories" },
  factoryStatus: { icon: "precision_manufacturing", label: "Factory Status" },
  planner: { icon: "event_note", label: "Production Planning" },
  inventory: { icon: "inventory_2", label: "Inventory" },
  notifications: { icon: "notifications", label: "Notifications" },
  analytics: { icon: "analytics", label: "Analytics" },
  financials: { icon: "payments", label: "Financials" },
  userManagement: { icon: "group", label: "User Management" },
  approvals: { icon: "fact_check", label: "Approvals" },
  masterDB: { icon: "database", label: "Master DB" },
  customerManagement: { icon: "hub", label: "Customer Management" },
  equipment: { icon: "construction", label: "Equipment" },
  scna: { icon: "lan", label: "SCNA" },
  noda: { icon: "settings_input_component", label: "Noda" },
  videoManual: { icon: "play_circle", label: "Video Manual" },
};

export default function PlaceholderPage({ page }) {
  const meta = pageLabels[page] || { icon: "web", label: page };

  return (
    <section className="min-h-screen max-w-[1600px] mx-auto space-y-6 pt-20 px-6 pb-12 flex items-center justify-center">
      <div className="freya-card rounded-[8px] p-10 text-center max-w-sm border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="w-12 h-12 rounded-[6px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] flex items-center justify-center mx-auto mb-4 shadow-2xs">
          <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>
            {meta.icon}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{meta.label}</h2>
        <p className="text-xs text-[var(--text-muted)]">
          This page is being migrated to React.
        </p>
        <div className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2.5 py-1 text-[10px] font-mono font-medium uppercase tracking-wider text-[var(--freya-blue)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--freya-blue)] animate-pulse" />
          Coming soon
        </div>
      </div>
    </section>
  );
}
