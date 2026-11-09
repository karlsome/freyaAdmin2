import { useState, useMemo } from "react";

export default function StatusGrid({ data = {}, onAskAI }) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFactory, setFilterFactory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const entities = data.entities || [];

  // Factory list
  const factories = useMemo(() => {
    const set = new Set();
    entities.forEach((e) => {
      if (e.factory) set.add(e.factory);
    });
    return ["all", ...Array.from(set)];
  }, [entities]);

  // Counts
  const counts = useMemo(() => {
    let running = 0;
    let idle = 0;
    let stopped = 0;
    entities.forEach((e) => {
      const s = (e.status || "running").toLowerCase();
      if (s === "running" || s === "operating" || s === "active") running++;
      else if (s === "idle" || s === "standby" || s === "waiting") idle++;
      else stopped++;
    });
    return { total: entities.length, running, idle, stopped };
  }, [entities]);

  // Filtered
  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      const s = (e.status || "running").toLowerCase();
      const statusMatch =
        filterStatus === "all" ||
        (filterStatus === "running" && (s === "running" || s === "operating" || s === "active")) ||
        (filterStatus === "idle" && (s === "idle" || s === "standby" || s === "waiting")) ||
        (filterStatus === "stopped" && (s === "stopped" || s === "error" || s === "down"));

      const factoryMatch = filterFactory === "all" || e.factory === filterFactory;

      const term = searchTerm.toLowerCase();
      const searchMatch =
        !searchTerm ||
        (e.name && e.name.toLowerCase().includes(term)) ||
        (e.operator && e.operator.toLowerCase().includes(term)) ||
        (e.currentPart && e.currentPart.toLowerCase().includes(term)) ||
        (e.hinban && e.hinban.toLowerCase().includes(term));

      return statusMatch && factoryMatch && searchMatch;
    });
  }, [entities, filterStatus, filterFactory, searchTerm]);

  return (
    <div className="space-y-4">
      {/* ── Headline Metric Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
            Total Monitored Units
          </span>
          <div className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] freya-tabular mt-0.5">
            {counts.total} <span className="text-xs font-normal text-[var(--text-muted)]">stations</span>
          </div>
        </div>

        <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
            Live Operating (Running)
          </span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 freya-tabular mt-0.5 flex items-center gap-2">
            <span>{counts.running}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {counts.total > 0 ? Math.round((counts.running / counts.total) * 100) : 0}% Active
            </span>
          </div>
        </div>

        <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
            Idle / Standby
          </span>
          <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 freya-tabular mt-0.5">
            {counts.idle} <span className="text-xs font-normal text-[var(--text-muted)]">standby</span>
          </div>
        </div>

        <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
            Offline / Stopped
          </span>
          <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 freya-tabular mt-0.5">
            {counts.stopped} <span className="text-xs font-normal text-[var(--text-muted)]">offline</span>
          </div>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Status Pills */}
          <div className="inline-flex p-0.5 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-2.5 h-7 rounded-[4px] text-xs font-semibold transition-all ${
                filterStatus === "all" ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-2xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              All ({counts.total})
            </button>
            <button
              onClick={() => setFilterStatus("running")}
              className={`px-2.5 h-7 rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterStatus === "running" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-2xs" : "text-[var(--text-muted)] hover:text-emerald-600"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Running ({counts.running})
            </button>
            <button
              onClick={() => setFilterStatus("idle")}
              className={`px-2.5 h-7 rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterStatus === "idle" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-2xs" : "text-[var(--text-muted)] hover:text-amber-600"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Idle ({counts.idle})
            </button>
            <button
              onClick={() => setFilterStatus("stopped")}
              className={`px-2.5 h-7 rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterStatus === "stopped" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 shadow-2xs" : "text-[var(--text-muted)] hover:text-rose-600"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Stopped ({counts.stopped})
            </button>
          </div>

          {/* Factory filter pills */}
          {factories.length > 2 && (
            <div className="flex items-center gap-1">
              {factories.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterFactory(f)}
                  className={`h-7 px-2.5 text-xs font-semibold rounded-[4px] border transition-all ${
                    filterFactory === f
                      ? "bg-[var(--freya-blue)] text-white border-[var(--freya-blue)] shadow-2xs"
                      : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {f === "all" ? "All Lines" : f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: 16 }}>
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter machine, 背番号, operator..."
            className="w-full h-8 pl-8 pr-3 text-xs rounded-[6px] bg-[var(--surface)] border border-[var(--border)] focus:outline-none focus:border-[var(--freya-blue)] text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors"
          />
        </div>
      </div>

      {/* ── Status Grid Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[460px] overflow-y-auto pr-1">
        {filteredEntities.length === 0 ? (
          <div className="col-span-full py-10 text-center text-xs text-[var(--text-muted)] bg-[var(--surface)] rounded-[6px] border border-[var(--border)]">
            No equipment matches the active filters.
          </div>
        ) : (
          filteredEntities.map((entity, idx) => {
            const s = (entity.status || "running").toLowerCase();
            const isRunning = s === "running" || s === "operating" || s === "active";
            const isIdle = s === "idle" || s === "standby" || s === "waiting";

            return (
              <div
                key={entity.id || idx}
                className="p-3.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--freya-blue)]/50 transition-all flex flex-col justify-between shadow-2xs gap-3 group"
              >
                {/* Header: Machine & Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`relative flex h-2.5 w-2.5 ${
                        isRunning ? "text-emerald-500" : isIdle ? "text-amber-500" : "text-rose-500"
                      }`}
                    >
                      {isRunning && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          isRunning ? "bg-emerald-500" : isIdle ? "bg-amber-500" : "bg-rose-500"
                        }`}
                      />
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--text-primary)] tracking-tight">
                      {entity.name}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] uppercase tracking-[0.04em] ${
                      isRunning
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : isIdle
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {entity.status || "Running"}
                  </span>
                </div>

                {/* Body Details: Current Part & Operator */}
                <div className="space-y-1.5 text-xs">
                  {entity.currentPart && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[var(--text-muted)]">背番号:</span>
                      <span className="font-mono font-bold text-xs bg-[var(--freya-blue-subtle)] text-[var(--freya-blue)] border border-[var(--freya-blue)]/30 px-2 py-0.5 rounded-[4px]">
                        {entity.currentPart}
                      </span>
                    </div>
                  )}

                  {entity.hinban && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-muted)]">品番:</span>
                      <span className="font-mono text-[var(--text-primary)] truncate max-w-[130px]">
                        {entity.hinban}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-muted)]">Operator:</span>
                    <span className="font-medium text-[var(--text-primary)] truncate max-w-[130px]">
                      {entity.operator || "—"}
                    </span>
                  </div>
                </div>

                {/* Footer: Facility & Batches */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[11px]">
                  <span className="text-[var(--text-muted)]">{entity.factory || "小瀬"}</span>
                  {entity.batches !== undefined && (
                    <span className="font-semibold freya-tabular text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {entity.batches} batches
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Suggested Followups */}
      {onAskAI && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)] font-medium">Investigate further:</span>
          <button
            onClick={() => onAskAI("Check defect rate and scrap loss across these machines")}
            className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
            <span>Check machine defect rates</span>
          </button>
          <button
            onClick={() => onAskAI("Rank operators by batch output on these stations")}
            className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>leaderboard</span>
            <span>Rank top operators</span>
          </button>
        </div>
      )}
    </div>
  );
}
