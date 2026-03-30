export default function TopNav({ isDark, onToggleTheme }) {
  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-8 z-40 font-headline antialiased">

      {/* Search */}
      <div className="flex items-center gap-6 flex-1">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
            search
          </span>
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-full pl-10 pr-4 py-2 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none"
            placeholder="Global system search..."
            type="text"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 text-outline hover:text-primary hover:bg-primary/5 dark:hover:text-on-surface dark:hover:bg-white/5 rounded-full transition-colors"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span className="material-symbols-outlined">
            {isDark ? "light_mode" : "dark_mode"}
          </span>
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-outline hover:text-primary hover:bg-primary/5 dark:hover:text-on-surface dark:hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-surface"></span>
        </button>

        {/* Settings */}
        <button className="p-2 text-outline hover:text-primary hover:bg-primary/5 dark:hover:text-on-surface dark:hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined">settings</span>
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-outline-variant"></div>

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-bold text-on-surface leading-none">Admin User</p>
            <p className="text-[10px] text-outline mt-0.5">System Overseer</p>
          </div>
          <div className="w-8 h-8 rounded-full kinetic-gradient ring-2 ring-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }}>person</span>
          </div>
        </div>
      </div>
    </header>
  );
}
