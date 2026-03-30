export default function TopNav() {
  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-[#1d2026] flex justify-between items-center px-8 z-40 font-headline antialiased">
      {/* Search */}
      <div className="flex items-center gap-6 flex-1">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            search
          </span>
          <input
            className="w-full bg-[#10131a] border-none rounded-lg pl-10 pr-4 py-2 text-sm text-on-surface-variant focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
            placeholder="Global system search..."
            type="text"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <button className="relative p-2 text-slate-400 hover:bg-white/5 rounded-full transition-colors">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#1d2026]"></span>
          </button>
          <button className="p-2 text-slate-400 hover:bg-white/5 rounded-full transition-colors">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>

        <div className="h-8 w-px bg-white/10"></div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-bold text-white leading-none">Admin User</p>
            <p className="text-[10px] text-slate-400">System Overseer</p>
          </div>
          <div className="w-8 h-8 rounded-full ring-2 ring-indigo-500/20 bg-indigo-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }}>person</span>
          </div>
        </div>
      </div>
    </header>
  );
}
