const navItems = [
  { icon: "dashboard",               label: "Dashboard",           page: "dashboard" },
  { icon: "factory",                  label: "Factories",           page: "factories" },
  { icon: "precision_manufacturing",  label: "Factory Status",      page: "factoryStatus" },
  { icon: "event_note",              label: "Production Planning", page: "planner" },
  { icon: "inventory_2",             label: "Inventory",           page: "inventory" },
  { icon: "notifications",           label: "Notifications",       page: "notifications" },
  { icon: "analytics",               label: "Analytics",           page: "analytics" },
  { icon: "payments",                label: "Financials",          page: "financials" },
  { icon: "group",                   label: "User Management",     page: "userManagement" },
  { icon: "fact_check",              label: "Approvals",           page: "approvals", badge: "12" },
  { icon: "database",                label: "Master DB",           page: "masterDB" },
  { icon: "hub",                     label: "Customer Management", page: "customerManagement" },
  { icon: "construction",            label: "Equipment",           page: "equipment" },
  { icon: "lan",                     label: "SCNA",                page: "scna" },
  { icon: "settings_input_component",label: "Noda",                page: "noda" },
  { icon: "play_circle",             label: "Video Manual",        page: "videoManual" },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="group fixed left-0 top-0 h-full w-16 hover:w-64 bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col py-6 z-50 font-headline text-sm font-medium overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">

      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-10 min-w-[256px]">
        <div className="w-10 h-10 flex-shrink-0 kinetic-gradient rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
            precision_manufacturing
          </span>
        </div>
        <div className="overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <h1 className="text-lg font-black text-on-surface leading-none whitespace-nowrap">Factory Admin</h1>
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold mt-0.5 whitespace-nowrap">Precision Control</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-hide px-3">
        {navItems.map((item) => {
          const isActive = activePage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              title={item.label}
              className={`w-full flex items-center gap-3 px-0 py-2.5 rounded-xl transition-all duration-200 ease-in-out text-left min-w-[232px] ${
                isActive
                  ? "text-primary bg-primary/5 dark:bg-transparent dark:shadow-[0_0_15px_rgba(192,193,255,0.2)]"
                  : "text-outline hover:text-primary hover:bg-primary/5 dark:hover:text-on-surface dark:hover:bg-white/5"
              }`}
            >
              {/* Fixed-width icon cell so items don't shift */}
              <span
                className="w-10 flex-shrink-0 flex items-center justify-center material-symbols-outlined"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className={`flex-1 whitespace-nowrap overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
                isActive ? "font-semibold" : ""
              }`}>{item.label}</span>
              {item.badge && (
                <span className="mr-2 flex-shrink-0 bg-error text-on-error text-[10px] px-1.5 py-0.5 rounded-full font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 dark:bg-error-container dark:text-on-error-container dark:rounded-md">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto pt-6 border-t border-outline-variant/20 space-y-0.5 px-3">
        <button className="w-full flex items-center gap-3 px-0 py-2.5 rounded-xl transition-all duration-200 text-outline hover:text-primary hover:bg-primary/5 dark:hover:text-on-surface dark:hover:bg-white/5 min-w-[232px]" title="Settings">
          <span className="w-10 flex-shrink-0 flex items-center justify-center material-symbols-outlined">settings</span>
          <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">Settings</span>
        </button>
        <button className="w-full flex items-center gap-3 px-0 py-2.5 rounded-xl transition-all duration-200 text-error/70 hover:text-error hover:bg-error/5 dark:text-outline dark:hover:text-on-surface dark:hover:bg-white/5 min-w-[232px]" title="Logout">
          <span className="w-10 flex-shrink-0 flex items-center justify-center material-symbols-outlined">logout</span>
          <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">Logout</span>
        </button>
      </div>
    </aside>
  );
}
