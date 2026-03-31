export default function TopNav({ isDark, onToggleTheme }) {
  return (
    <header className="topnav-glass fixed top-0 right-0 left-16 h-16 flex justify-between items-center px-8 z-40 font-headline antialiased">

      {/* Search */}
      <div className="flex items-center gap-6 flex-1">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: 18 }}>
            search
          </span>
          <input
            className="w-full bg-white/10 dark:bg-white/5 border border-primary/20 dark:border-primary/20 rounded-full pl-10 pr-4 py-2 text-sm text-on-surface placeholder:text-outline/70 focus:ring-2 focus:ring-primary/30 focus:border-primary/40 focus:bg-white/20 dark:focus:bg-white/8 transition-all outline-none backdrop-blur-sm"
            placeholder="Global system search..."
            type="text"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 text-outline hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span className="material-symbols-outlined">
            {isDark ? "light_mode" : "dark_mode"}
          </span>
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-outline hover:text-primary hover:bg-primary/10 rounded-xl transition-all">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-transparent"></span>
        </button>

        {/* Settings */}
        <button className="p-2 text-outline hover:text-primary hover:bg-primary/10 rounded-xl transition-all">
          <span className="material-symbols-outlined">settings</span>
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-primary/20 mx-2"></div>

        {/* User */}
        <div className="flex items-center gap-3 pl-1">
          <div className="text-right">
            <p className="text-xs font-bold text-on-surface leading-none">Admin User</p>
            <p className="text-[10px] text-outline mt-0.5">System Overseer</p>
          </div>
          <div className="w-8 h-8 rounded-full kinetic-gradient ring-2 ring-primary/30 shadow-[0_0_12px_rgba(99,102,241,0.35)] flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>person</span>
          </div>
        </div>
      </div>
    </header>
  );
}
