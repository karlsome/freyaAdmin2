export default function TopNav({ isDark, onOpenMobileNav, onToggleTheme }) {
  return (
    <header className="topnav-glass fixed top-0 right-0 left-0 z-40 flex h-16 items-center justify-between px-4 font-headline antialiased sm:px-6 md:left-16 md:px-8">

      {/* Search */}
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4 md:gap-6">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-outline transition-all hover:bg-primary/10 hover:text-primary md:hidden"
          aria-label="Open navigation menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="relative w-full min-w-0 max-w-md">
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
      <div className="ml-3 flex flex-shrink-0 items-center gap-1 sm:gap-2">

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
        <button className="hidden rounded-xl p-2 text-outline transition-all hover:bg-primary/10 hover:text-primary sm:block">
          <span className="material-symbols-outlined">settings</span>
        </button>

        {/* Divider */}
        <div className="mx-2 hidden h-8 w-px bg-primary/20 sm:block"></div>

        {/* User */}
        <div className="flex items-center gap-3 pl-1">
          <div className="hidden text-right sm:block">
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
