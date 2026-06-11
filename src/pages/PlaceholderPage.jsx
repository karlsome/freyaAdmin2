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
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide flex items-center justify-center">
      <div className="glass-card rounded-3xl p-16 text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl kinetic-gradient flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-white" style={{ fontSize: 28, fontVariationSettings: "'FILL' 1" }}>
            {meta.icon}
          </span>
        </div>
        <h2 className="text-2xl font-semibold text-on-surface mb-2">{meta.label}</h2>
        <p className="text-sm text-on-surface-variant">
          This page is being migrated to React.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-primary font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
          Coming soon
        </div>
      </div>
    </section>
  );
}
