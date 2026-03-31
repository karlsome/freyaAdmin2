import { useState } from "react";

// ─── TagInput ─────────────────────────────────────────────────────────────────
function TagInput({ tags, onAdd, onRemove, placeholder }) {
  const [val, setVal] = useState("");
  const commit = () => {
    const t = val.trim().toUpperCase();
    if (t && !tags.includes(t)) onAdd(t);
    setVal("");
  };
  return (
    <div
      className="min-h-10 flex flex-wrap gap-1 items-center px-3 py-1.5 rounded-xl
                 bg-surface-container border border-white/10 focus-within:border-primary/40 transition-colors cursor-text"
      onClick={(e) => e.currentTarget.querySelector("input")?.focus()}
    >
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-bold">
          {t}
          <button type="button" onClick={() => onRemove(t)} className="hover:text-error leading-none">×</button>
        </span>
      ))}
      <input
        type="text"
        value={val}
        placeholder={tags.length ? "" : placeholder}
        className="flex-1 min-w-24 bg-transparent outline-none text-xs text-on-surface placeholder:text-outline"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
        }}
        onBlur={commit}
      />
    </div>
  );
}

// ─── ProductionFilterBar ──────────────────────────────────────────────────────
// Props:
//   defaultDateFrom  — initial "from" date string (YYYY-MM-DD), defaults to today
//   defaultDateTo    — initial "to" date string (YYYY-MM-DD), defaults to today
//   loading          — bool, disables Apply button while parent is fetching
//   onApply          — callback({ dateFrom, dateTo, partNumbers, serialNumbers })
//   onLotFinderOpen  — optional callback; when provided, shows Manufacturing Lot Finder button
//   children         — optional extra filter fields rendered inside the same grid
function todayStr() { return new Date().toISOString().split("T")[0]; }

export default function ProductionFilterBar({
  defaultDateFrom = todayStr(),
  defaultDateTo   = todayStr(),
  loading         = false,
  onApply,
  onLotFinderOpen,
  children,
}) {
  const [dateFrom,      setDateFrom]      = useState(defaultDateFrom);
  const [dateTo,        setDateTo]        = useState(defaultDateTo);
  const [partNumbers,   setPartNumbers]   = useState([]);
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [advancedOpen,  setAdvancedOpen]  = useState(false);

  const handleApply = () => {
    onApply?.({ dateFrom, dateTo, partNumbers, serialNumbers });
  };

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      {/* Core filters grid — always 4 base columns + any extras via children */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-10 px-3 rounded-xl bg-surface-container border border-white/10 text-sm text-on-surface outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-10 px-3 rounded-xl bg-surface-container border border-white/10 text-sm text-on-surface outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">品番 (Part No.)</label>
          <TagInput
            tags={partNumbers}
            onAdd={(t) => setPartNumbers((v) => [...v, t])}
            onRemove={(t) => setPartNumbers((v) => v.filter((x) => x !== t))}
            placeholder="Enter to add…"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">背番号 (Serial No.)</label>
          <TagInput
            tags={serialNumbers}
            onAdd={(t) => setSerialNumbers((v) => [...v, t])}
            onRemove={(t) => setSerialNumbers((v) => v.filter((x) => x !== t))}
            placeholder="Enter to add…"
          />
        </div>

        {/* Extra filters injected by the parent page */}
        {children}
      </div>

      {/* Advanced filters (expandable) */}
      <button
        className="flex items-center gap-1.5 text-xs font-bold text-outline hover:text-on-surface transition-colors mb-3"
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {advancedOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
        </span>
        Advanced Filters
      </button>
      {advancedOpen && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 rounded-xl bg-surface-container/40 border border-white/10">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-outline">製造ロット</label>
            <input
              type="text"
              placeholder="例: 241227 (min 3 characters)"
              className="h-10 px-3 rounded-xl bg-surface-container border border-white/10 text-sm
                         text-on-surface placeholder:text-outline outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          disabled={loading}
          onClick={handleApply}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl kinetic-gradient text-white text-sm font-bold
                     hover:opacity-90 disabled:opacity-50 transition-opacity shadow-[0_0_20px_rgba(99,102,241,0.25)]"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
          {loading ? "Loading…" : "Apply Filters"}
        </button>

        {onLotFinderOpen && (
          <button
            onClick={onLotFinderOpen}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-card border border-white/10 text-sm font-bold
                       text-on-surface hover:border-primary/30 hover:scale-[1.02] transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>manage_search</span>
            Manufacturing Lot Finder
          </button>
        )}
      </div>
    </div>
  );
}
