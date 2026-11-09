import { useState, useMemo, useEffect } from "react";

export default function AISpotlightCard({ spotlight, onClose, onAskAI }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFactory, setSelectedFactory] = useState(spotlight?.factory || "All");
  const [viewMode, setViewMode] = useState(spotlight?.defaultView || "table"); // 'table' | 'machines' | 'grid'

  // Sync state whenever spotlight prop updates
  useEffect(() => {
    console.log("[AISpotlightCard] Spotlight prop received:", spotlight);
    if (spotlight?.defaultView) {
      setViewMode(spotlight.defaultView);
    }
    const fact = spotlight?.factory;
    if (!fact || fact === "All" || fact.includes("All")) {
      setSelectedFactory("All");
    } else {
      setSelectedFactory(fact);
    }
  }, [spotlight]);

  if (!spotlight) return null;

  const type = spotlight.type || "workers";
  const workers = spotlight.workers || spotlight.activeWorkers || [];
  const parts = spotlight.parts || [];
  const defects = spotlight.defects || [];

  const isAllFactory = !selectedFactory || selectedFactory === "All" || selectedFactory.includes("All");

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    if (type !== "workers") return [];
    return workers.filter((w) => {
      const matchesSearch =
        !searchTerm ||
        (w.name && w.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (w.machine && w.machine.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFactory =
        isAllFactory ||
        w.factory === selectedFactory ||
        (selectedFactory.includes("小瀬") && (!w.factory || w.factory.includes("小瀬") || w.factory.includes("Oze"))) ||
        (selectedFactory.includes("倉知") && w.factory?.includes("倉知"));
      return matchesSearch && matchesFactory;
    });
  }, [workers, searchTerm, selectedFactory, isAllFactory, type]);

  // Filtered parts / sebanggo list
  const filteredParts = useMemo(() => {
    if (type !== "sebanggo" && type !== "parts") return [];
    return parts.filter((p) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (p.sebanggo && p.sebanggo.toLowerCase().includes(term)) ||
        (p.hinban && p.hinban.toLowerCase().includes(term)) ||
        (Array.isArray(p.machines) && p.machines.some((m) => m.toLowerCase().includes(term))) ||
        (Array.isArray(p.workers) && p.workers.some((w) => w.toLowerCase().includes(term)));
      const matchesFactory =
        isAllFactory ||
        p.factory === selectedFactory ||
        (selectedFactory.includes("小瀬") && (!p.factory || p.factory.includes("小瀬") || p.factory.includes("Oze"))) ||
        (selectedFactory.includes("倉知") && p.factory?.includes("倉知"));
      return matchesSearch && matchesFactory;
    });
  }, [parts, searchTerm, selectedFactory, isAllFactory, type]);

  // Console debug log for user diagnostics
  console.log("[AISpotlightCard] Current State:", {
    spotlightTitle: spotlight?.title,
    spotlightType: type,
    spotlightFactory: spotlight?.factory,
    selectedFactory,
    isAllFactory,
    totalRawParts: parts.length,
    filteredPartsCount: filteredParts.length,
    viewMode,
    searchTerm,
    sampleParts: parts.slice(0, 3)
  });

  // Unique factories available in dataset
  const availableFactories = useMemo(() => {
    const set = new Set();
    if (type === "workers") {
      workers.forEach((w) => {
        if (w.factory) set.add(w.factory);
      });
    } else if (type === "sebanggo" || type === "parts") {
      parts.forEach((p) => {
        if (p.factory) set.add(p.factory);
      });
    }
    return ["All", ...Array.from(set)];
  }, [workers, parts, type]);

  // Total unique workers
  const uniqueNamesCount = useMemo(() => {
    return new Set(filteredWorkers.map((w) => w.name)).size;
  }, [filteredWorkers]);

  const totalWorkerBatches = useMemo(() => {
    return filteredWorkers.reduce((acc, w) => acc + (w.batches || 0), 0);
  }, [filteredWorkers]);

  // Total parts metrics
  const uniqueSebanggoCount = useMemo(() => {
    return new Set(filteredParts.map((p) => p.sebanggo)).size;
  }, [filteredParts]);

  const totalPartBatches = useMemo(() => {
    return filteredParts.reduce((acc, p) => acc + (p.batches || 0), 0);
  }, [filteredParts]);

  const allActiveMachinesForParts = useMemo(() => {
    const mSet = new Set();
    filteredParts.forEach((p) => {
      if (Array.isArray(p.machines)) p.machines.forEach((m) => mSet.add(m));
    });
    return mSet.size;
  }, [filteredParts]);

  // Group by Equipment / Machine Station for the "Machines View"
  const activeMachinesList = useMemo(() => {
    const map = new Map();
    filteredParts.forEach((p) => {
      const machList = Array.isArray(p.machines) && p.machines.length > 0 ? p.machines : ["General Station"];
      machList.forEach((m) => {
        if (!map.has(m)) {
          map.set(m, {
            machine: m,
            factory: p.factory || "小瀬",
            parts: new Set(),
            hinbans: new Set(),
            workers: new Set(),
            batches: 0
          });
        }
        const item = map.get(m);
        if (p.sebanggo) item.parts.add(p.sebanggo);
        if (p.hinban) item.hinbans.add(p.hinban);
        if (Array.isArray(p.workers)) p.workers.forEach((w) => item.workers.add(w));
        item.batches += (p.batches || 0);
      });
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        partsList: Array.from(item.parts),
        hinbansList: Array.from(item.hinbans),
        workersList: Array.from(item.workers)
      }))
      .sort((a, b) => b.batches - a.batches);
  }, [filteredParts]);

  const isPartsMode = type === "sebanggo" || type === "parts";

  return (
    <div className="rounded-[10px] bg-[var(--surface)] border-2 border-[var(--freya-blue)]/50 shadow-md p-5 sm:p-7 flex flex-col gap-5 transition-all duration-300 relative overflow-hidden">
      {/* Top subtle highlight banner */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--freya-blue)] via-sky-400 to-indigo-500" />

      {/* ── Header: AI Badge, Title & Close Button ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-[8px] bg-[var(--freya-blue-subtle)] border border-[var(--freya-blue)]/30 text-[var(--freya-blue)] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
              {isPartsMode ? (viewMode === "machines" ? "precision_manufacturing" : "category") : type === "workers" ? "badge" : type === "defects" ? "warning" : "auto_awesome"}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-[11px] font-bold uppercase tracking-[0.06em] bg-[var(--freya-blue-subtle)] text-[var(--freya-blue)] border border-[var(--freya-blue)]/30">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>
                AI Focused View
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Floor Data
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] mt-1 tracking-tight">
              {spotlight.title || (isPartsMode ? "Active Equipment & 背番号 (Sebanggo) Processing" : type === "workers" ? "Active Floor Personnel & Shift Assignments" : "AI Inspection Report")}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
              {spotlight.summary || (isPartsMode ? "Zero-noise breakdown of active equipment, parts, and assigned stations today." : type === "workers" ? "Zero-noise breakdown of active operators and their assigned machines today." : "Focused diagnostics based on your query.")}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isPartsMode && (
            <div className="inline-flex p-0.5 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
              <button
                onClick={() => setViewMode("table")}
                title="Table View (by 背番号 / Parts)"
                className={`px-2.5 h-7 rounded-[4px] flex items-center gap-1.5 text-xs transition-colors ${
                  viewMode === "table" ? "bg-[var(--surface)] text-[var(--freya-blue)] shadow-2xs font-semibold" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>table_rows</span>
                <span className="hidden sm:inline">Parts View</span>
              </button>
              <button
                onClick={() => setViewMode("machines")}
                title="Machines View (by Station & Equipment)"
                className={`px-2.5 h-7 rounded-[4px] flex items-center gap-1.5 text-xs transition-colors ${
                  viewMode === "machines" ? "bg-[var(--surface)] text-[var(--freya-blue)] shadow-2xs font-semibold" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>precision_manufacturing</span>
                <span className="hidden sm:inline">Machines View</span>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                title="Card Grid View"
                className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition-colors ${
                  viewMode === "grid" ? "bg-[var(--surface)] text-[var(--freya-blue)] shadow-2xs font-semibold" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>grid_view</span>
              </button>
            </div>
          )}

          {type === "workers" && (
            <div className="inline-flex p-0.5 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
              <button
                onClick={() => setViewMode("table")}
                title="Table View"
                className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition-colors ${
                  viewMode === "table" ? "bg-[var(--surface)] text-[var(--freya-blue)] shadow-2xs font-semibold" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>table_rows</span>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                title="Card Grid View"
                className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition-colors ${
                  viewMode === "grid" ? "bg-[var(--surface)] text-[var(--freya-blue)] shadow-2xs font-semibold" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>grid_view</span>
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            title="Dismiss AI focus and view standard dashboard cards"
            className="flex items-center gap-1.5 h-8 px-3 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            <span>Dismiss Focus</span>
          </button>
        </div>
      </div>

      {/* ── Spotlight Specific View: SEBANGGO / PARTS / MACHINES ── */}
      {isPartsMode && (
        <div className="space-y-4">
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                Active Equipment (Machines)
              </span>
              <div className="text-xl sm:text-2xl font-bold text-[var(--freya-blue)] freya-tabular mt-0.5">
                {allActiveMachinesForParts} <span className="text-xs font-normal text-[var(--text-muted)]">stations</span>
              </div>
            </div>

            <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                Active 背番号 (Models)
              </span>
              <div className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] freya-tabular mt-0.5">
                {uniqueSebanggoCount} <span className="text-xs font-normal text-[var(--text-muted)]">models</span>
              </div>
            </div>

            <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                Total Production Batches
              </span>
              <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 freya-tabular mt-0.5">
                {totalPartBatches.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">runs</span>
              </div>
            </div>

            <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                Top Volume Station
              </span>
              <div className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate mt-1">
                {activeMachinesList[0]?.machine ? (
                  <>
                    <span className="font-mono text-[var(--freya-blue)]">{activeMachinesList[0].machine}</span>
                    <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">({activeMachinesList[0].batches}b)</span>
                  </>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>

          {/* Search & Factory Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {availableFactories.map((f) => {
                const isSelected = (f === "All" && isAllFactory) || selectedFactory === f;
                return (
                  <button
                    key={f}
                    onClick={() => setSelectedFactory(f)}
                    className={`h-7 px-3 text-xs font-semibold rounded-[4px] border transition-all ${
                      isSelected
                        ? "bg-[var(--freya-blue)] text-white border-[var(--freya-blue)] shadow-2xs"
                        : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {f === "All" ? "All Factories" : f}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: 16 }}>
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search machine, 背番号, 品番, operator..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-[6px] bg-[var(--surface)] border border-[var(--border)] focus:outline-none focus:border-[var(--freya-blue)] text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
                </button>
              )}
            </div>
          </div>

          {/* ── View Mode: MACHINES VIEW (Grouped by Machine / Station) ── */}
          {viewMode === "machines" ? (
            <div className="rounded-[6px] border border-[var(--border)] overflow-hidden bg-[var(--surface)] shadow-2xs">
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)] sticky top-0 z-10">
                    <tr className="text-[var(--text-muted)] text-[11px] font-semibold uppercase tracking-[0.04em]">
                      <th className="py-2.5 px-4">Machine / Station (設備)</th>
                      <th className="py-2.5 px-4">Assigned 背番号 (Sebanggo)</th>
                      <th className="py-2.5 px-4">品番 (Part Numbers)</th>
                      <th className="py-2.5 px-4">Operator on Shift</th>
                      <th className="py-2.5 px-4">Facility</th>
                      <th className="py-2.5 px-4 text-right">Batches Run</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {activeMachinesList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          No active equipment records match the search criteria.
                        </td>
                      </tr>
                    ) : (
                      activeMachinesList.map((mItem, idx) => (
                        <tr key={idx} className="hover:bg-[var(--surface-hover)]/70 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-[var(--text-primary)]">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-mono font-bold text-xs bg-[var(--surface-hover)] text-[var(--freya-blue)] border border-[var(--border)] shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {mItem.machine}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {mItem.partsList.map((pCode, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="inline-flex items-center px-2 py-0.5 rounded-[4px] font-mono font-bold text-[11px] bg-[var(--freya-blue-subtle)] text-[var(--freya-blue)] border border-[var(--freya-blue)]/30"
                                >
                                  {pCode}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-[var(--text-muted)]">
                            {mItem.hinbansList.slice(0, 3).join(", ") || "—"}
                            {mItem.hinbansList.length > 3 && ` +${mItem.hinbansList.length - 3}`}
                          </td>
                          <td className="py-2.5 px-4 text-[var(--text-primary)] font-medium">
                            {mItem.workersList.join(", ") || "—"}
                          </td>
                          <td className="py-2.5 px-4 text-[var(--text-muted)] font-medium">
                            {mItem.factory || "小瀬"}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold freya-tabular text-[var(--text-primary)]">
                            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-[4px]">
                              {mItem.batches} batches
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Operating
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : viewMode === "table" ? (
            /* ── View Mode: PARTS TABLE ── */
            <div className="rounded-[6px] border border-[var(--border)] overflow-hidden bg-[var(--surface)] shadow-2xs">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)] sticky top-0 z-10">
                    <tr className="text-[var(--text-muted)] text-[11px] font-semibold uppercase tracking-[0.04em]">
                      <th className="py-2.5 px-4">背番号 (Sebanggo)</th>
                      <th className="py-2.5 px-4">品番 (Part Number / Hinban)</th>
                      <th className="py-2.5 px-4">Assigned Line(s)</th>
                      <th className="py-2.5 px-4">Operator(s)</th>
                      <th className="py-2.5 px-4">Facility</th>
                      <th className="py-2.5 px-4 text-right">Runs / Batches</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredParts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          No active 背番号 records match the search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredParts.map((part, idx) => (
                        <tr key={idx} className="hover:bg-[var(--surface-hover)]/70 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-[var(--text-primary)]">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] font-mono font-bold text-xs bg-[var(--freya-blue-subtle)] text-[var(--freya-blue)] border border-[var(--freya-blue)]/30 shadow-2xs">
                              {part.sebanggo}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-[var(--text-primary)]">
                            {part.hinban}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {part.machines && part.machines.length > 0 ? (
                                part.machines.map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    className="font-mono text-[11px] text-[var(--text-primary)] bg-[var(--surface-hover)] px-1.5 py-0.5 rounded border border-[var(--border)]"
                                  >
                                    {m}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[var(--text-muted)] text-[11px]">General Station</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-[var(--text-primary)] font-medium">
                            {part.workers && part.workers.length > 0 ? part.workers.join(", ") : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-[var(--text-muted)] font-medium">
                            {part.factory || "小瀬"}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold freya-tabular text-[var(--text-primary)]">
                            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-[4px]">
                              {part.batches} batches
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Running Today
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ── View Mode: CARD GRID ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-1">
              {filteredParts.map((part, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--freya-blue)]/50 transition-all flex flex-col justify-between shadow-2xs gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] font-mono font-bold text-xs bg-[var(--freya-blue-subtle)] text-[var(--freya-blue)] border border-[var(--freya-blue)]/30">
                        {part.sebanggo}
                      </span>
                      <h4 className="font-mono text-xs font-semibold text-[var(--text-primary)] mt-1.5 truncate">
                        {part.hinban}
                      </h4>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded freya-tabular">
                      {part.batches}b
                    </span>
                  </div>

                  <div className="text-xs pt-2 border-t border-[var(--border)] flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>Line:</span>
                      <span className="font-mono text-[var(--text-primary)] truncate max-w-[120px]">
                        {part.machines?.join(", ") || "General"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>Operator:</span>
                      <span className="text-[var(--text-primary)] font-medium truncate max-w-[120px]">
                        {part.workers?.join(", ") || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick follow-up action chips */}
          {onAskAI && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">Ask Copilot next:</span>
              <button
                onClick={() => onAskAI("Show quality defects and scrap volume for these 背番号 today")}
                className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                <span>Check defects for these parts</span>
              </button>
              <button
                onClick={() => onAskAI("Show active workers and line balance across these stations")}
                className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>badge</span>
                <span>View assigned workers</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Spotlight Specific View: WORKERS ── */}
      {type === "workers" && (
        <div className="space-y-4">
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                Active Operators
              </span>
              <div className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] freya-tabular mt-0.5">
                {uniqueNamesCount} <span className="text-xs font-normal text-[var(--text-muted)]">on shift</span>
              </div>
            </div>

            <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                Active Lines / Machines
              </span>
              <div className="text-xl sm:text-2xl font-bold text-[var(--freya-blue)] freya-tabular mt-0.5">
                {new Set(filteredWorkers.map((w) => w.machine)).size} <span className="text-xs font-normal text-[var(--text-muted)]">stations</span>
              </div>
            </div>

            <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                Total Batches Today
              </span>
              <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 freya-tabular mt-0.5">
                {totalWorkerBatches.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">runs</span>
              </div>
            </div>

            <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                Top Volume Operator
              </span>
              <div className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate mt-1">
                {filteredWorkers[0]?.name || "—"}
                {filteredWorkers[0]?.batches > 0 && (
                  <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">({filteredWorkers[0].batches}b)</span>
                )}
              </div>
            </div>
          </div>

          {/* Search & Factory Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {availableFactories.map((f) => {
                const isSelected = (f === "All" && isAllFactory) || selectedFactory === f;
                return (
                  <button
                    key={f}
                    onClick={() => setSelectedFactory(f)}
                    className={`h-7 px-3 text-xs font-semibold rounded-[4px] border transition-all ${
                      isSelected
                        ? "bg-[var(--freya-blue)] text-white border-[var(--freya-blue)] shadow-2xs"
                        : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {f === "All" ? "All Factories" : f}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: 16 }}>
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search operator or machine..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-[6px] bg-[var(--surface)] border border-[var(--border)] focus:outline-none focus:border-[var(--freya-blue)] text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
                </button>
              )}
            </div>
          </div>

          {/* ── View Mode: TABLE ── */}
          {viewMode === "table" ? (
            <div className="rounded-[6px] border border-[var(--border)] overflow-hidden bg-[var(--surface)] shadow-2xs">
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)] sticky top-0 z-10">
                    <tr className="text-[var(--text-muted)] text-[11px] font-semibold uppercase tracking-[0.04em]">
                      <th className="py-2.5 px-4">Operator Name</th>
                      <th className="py-2.5 px-4">Assigned Machine / Station</th>
                      <th className="py-2.5 px-4">Facility</th>
                      <th className="py-2.5 px-4 text-right">Runs / Batches</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredWorkers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          No active operators match the search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredWorkers.map((worker, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-[var(--surface-hover)]/70 transition-colors"
                        >
                          <td className="py-2.5 px-4 font-semibold text-[var(--text-primary)]">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center font-bold text-[11px] text-[var(--freya-blue)]">
                                {worker.name.charAt(0)}
                              </div>
                              <span>{worker.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="font-mono text-xs text-[var(--text-primary)] bg-[var(--surface-hover)] px-2 py-0.5 rounded-[4px] border border-[var(--border)]">
                              {worker.machine || "General Station"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-[var(--text-muted)] font-medium">
                            {worker.factory || "小瀬"}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold freya-tabular text-[var(--text-primary)]">
                            {worker.batches > 0 ? (
                              <span className="text-[var(--freya-blue)] bg-[var(--freya-blue-subtle)] px-2 py-0.5 rounded-[4px]">
                                {worker.batches} batches
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)]">Active</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active Shift
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ── View Mode: CARD GRID ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredWorkers.map((worker, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--freya-blue)]/50 transition-all flex flex-col justify-between shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center font-bold text-xs text-[var(--freya-blue)]">
                        {worker.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--text-primary)] leading-tight">
                          {worker.name}
                        </h4>
                        <span className="text-[10px] text-[var(--text-muted)]">{worker.factory || "小瀬"}</span>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1" title="Active on shift" />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--border)]">
                    <span className="font-mono text-[11px] text-[var(--text-muted)] truncate max-w-[120px]">
                      {worker.machine}
                    </span>
                    {worker.batches > 0 && (
                      <span className="font-semibold text-[var(--freya-blue)] bg-[var(--freya-blue-subtle)] px-1.5 py-0.5 rounded text-[10px] freya-tabular">
                        {worker.batches}b
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick AI follow-up pills */}
          {onAskAI && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">Ask Copilot next:</span>
              <button
                onClick={() => onAskAI("Analyze operator efficiency and machine balance at 小瀬 today")}
                className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>analytics</span>
                <span>Check operator efficiency</span>
              </button>
              <button
                onClick={() => onAskAI("Show top defect issues across these machines today")}
                className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                <span>Check machine defects</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Spotlight Specific View: DEFECTS ── */}
      {type === "defects" && (
        <div className="space-y-4">
          <div className="rounded-[6px] border border-[var(--border)] overflow-hidden bg-[var(--surface)] shadow-2xs">
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)] sticky top-0 z-10">
                  <tr className="text-[var(--text-muted)] text-[11px] font-semibold uppercase tracking-[0.04em]">
                    <th className="py-2.5 px-4">Part # (品番)</th>
                    <th className="py-2.5 px-4">Back # (背番号)</th>
                    <th className="py-2.5 px-4">Facility</th>
                    <th className="py-2.5 px-4 text-right">Total Run</th>
                    <th className="py-2.5 px-4 text-right">Scrap / NG</th>
                    <th className="py-2.5 px-4 text-right">Trouble Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {defects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                        No active defect records found.
                      </td>
                    </tr>
                  ) : (
                    defects.map((d, idx) => (
                      <tr key={idx} className="hover:bg-[var(--surface-hover)]/70 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-[var(--text-primary)] font-mono">{d.hinban}</td>
                        <td className="py-2.5 px-4 text-[var(--text-muted)] font-mono">{d.sebanggo}</td>
                        <td className="py-2.5 px-4">{d.factory}</td>
                        <td className="py-2.5 px-4 text-right freya-tabular">{d.total?.toLocaleString() || 0}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-rose-600 dark:text-rose-400 freya-tabular">
                          +{d.totalNG} NG
                        </td>
                        <td className="py-2.5 px-4 text-right text-amber-600 dark:text-amber-400 freya-tabular">
                          {d.troubleHours > 0 ? `${d.troubleHours}h` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
