const navItems = [
  { icon: "dashboard", label: "Dashboard", active: true },
  { icon: "factory", label: "Factories" },
  { icon: "precision_manufacturing", label: "Factory Status" },
  { icon: "event_note", label: "Production Planning" },
  { icon: "inventory_2", label: "Inventory" },
  { icon: "notifications", label: "Notifications" },
  { icon: "analytics", label: "Analytics" },
  { icon: "payments", label: "Financials" },
  { icon: "group", label: "User Management" },
  { icon: "fact_check", label: "Approvals", badge: "12" },
  { icon: "database", label: "Master DB" },
  { icon: "hub", label: "Customer Management" },
  { icon: "construction", label: "Equipment" },
  { icon: "lan", label: "SCNA" },
  { icon: "settings_input_component", label: "Noda" },
  { icon: "play_circle", label: "Video Manual" },
];

const bottomItems = [
  { icon: "settings", label: "Settings" },
  { icon: "logout", label: "Logout" },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#0b0e14] flex flex-col py-6 px-4 z-50 font-headline text-sm font-medium">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-10">
        <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
          <span className="material-symbols-outlined text-white">precision_manufacturing</span>
        </div>
        <div>
          <h1 className="text-lg font-black text-white leading-none">Factory Admin</h1>
          <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">Precision Control</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto pr-2 scrollbar-hide">
        {navItems.map((item) => (
          <a
            key={item.label}
            href="#"
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 ease-in-out ${
              item.active
                ? "text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                : "text-slate-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span className="bg-error-container text-on-error-container text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                {item.badge}
              </span>
            )}
          </a>
        ))}
      </nav>

      {/* Bottom */}
      <div className="mt-auto pt-6 border-t border-white/5 space-y-1">
        {bottomItems.map((item) => (
          <a
            key={item.label}
            href="#"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ease-in-out text-slate-500 hover:text-white hover:bg-white/5"
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </aside>
  );
}
