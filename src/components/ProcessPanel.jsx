//This component displays a paginated, sortable, and searchable table of production records for a specific process (Kensa, Press, SRS, or Slit). It also includes a summary section that aggregates data by part number and worker ID. The component is designed to be reusable for different processes by passing the appropriate props.
import { useState, useEffect, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 25;

export const PROCESS_ACCENT = {
  Kensa: { dot: "bg-amber-400",   label: "text-amber-400" },
  Press: { dot: "bg-emerald-400", label: "text-emerald-400" },
  SRS:   { dot: "bg-slate-400",   label: "text-slate-400" },
  Slit:  { dot: "bg-sky-400",     label: "text-sky-400" },
};

const SORT_NUMERIC = new Set(["Total", "Total_NG", "Process_Quantity", "Remaining_Quantity", "Cycle_Time"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcWorkHours(start, end) {
  if (!start || !end) return null;
  const s = new Date(`2000-01-01T${start}`);
  const e = new Date(`2000-01-01T${end}`);
  if (e <= s) return null;
  return (e - s) / 3_600_000;
}

function defectChip(rate) {
  const n = parseFloat(rate);
  if (n > 2) return "bg-error/15 text-error";
  if (n > 1) return "bg-amber-400/15 text-amber-400";
  return "bg-emerald-400/15 text-emerald-400";
}

function groupSummary(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const key = `${r["品番"]}__${r["背番号"]}`;
    if (!map.has(key)) map.set(key, { hinban: r["品番"], sebanggo: r["背番号"], total: 0, ng: 0 });
    const e = map.get(key);
    e.total += Number(r.Process_Quantity) || Number(r.Total) || 0;
    e.ng    += Number(r.Total_NG) || 0;
  });
  return Array.from(map.values());
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ total, page, onPage }) {
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  if (totalPages <= 1) return null;
  const start = (page - 1) * ITEMS_PER_PAGE + 1;
  const end   = Math.min(page * ITEMS_PER_PAGE, total);
  const rangeStart = Math.max(1, page - 2);
  const pages = Array.from({ length: Math.min(5, totalPages - rangeStart + 1) }, (_, i) => rangeStart + i);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
      <span className="text-[11px] text-outline">{start}–{end} of {total}</span>
      <div className="flex gap-1">
        <button disabled={page === 1} onClick={() => onPage(page - 1)}
          className="px-2.5 py-1 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          前へ
        </button>
        {pages.map((p) => (
          <button key={p} onClick={() => onPage(p)}
            className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
              p === page ? "kinetic-gradient text-white shadow-sm" : "hover:bg-surface-container text-on-surface-variant"
            }`}>{p}</button>
        ))}
        <button disabled={page === totalPages} onClick={() => onPage(page + 1)}
          className="px-2.5 py-1 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          次へ
        </button>
      </div>
    </div>
  );
}

// ─── ProcessPanel ─────────────────────────────────────────────────────────────
// Props:
//   processName — "Kensa" | "Press" | "SRS" | "Slit"
//   rows        — array of raw production records from the matching DB
//   onRowClick  — callback(record, processName) when a row is clicked
export default function ProcessPanel({ processName, rows, onRowClick }) {
  const accent = PROCESS_ACCENT[processName] ?? PROCESS_ACCENT.Kensa;
  const [sort, setSort]               = useState({ col: null, dir: 1 });
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const summaryRef = useRef(null);

  useEffect(() => setPage(1), [rows]);

  const handleSort = (col) => {
    setSort((prev) => prev.col === col ? { col, dir: prev.dir * -1 } : { col, dir: 1 });
    setPage(1);
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r["品番"]?.toLowerCase().includes(s)) ||
           (r["背番号"]?.toLowerCase().includes(s)) ||
           (r.Worker_Name?.toLowerCase().includes(s));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sort.col) return 0;
    if (sort.col === "Work_Hours") {
      const ha = calcWorkHours(a.Time_start, a.Time_end) ?? -1;
      const hb = calcWorkHours(b.Time_start, b.Time_end) ?? -1;
      return (ha - hb) * sort.dir;
    }
    if (sort.col === "Defect_Rate") {
      const qa = Number(a.Process_Quantity) || 0;
      const qb = Number(b.Process_Quantity) || 0;
      const ra = qa ? (Number(a.Total_NG) || 0) / qa : 0;
      const rb = qb ? (Number(b.Total_NG) || 0) / qb : 0;
      return (ra - rb) * sort.dir;
    }
    const va = a[sort.col] ?? "";
    const vb = b[sort.col] ?? "";
    if (SORT_NUMERIC.has(sort.col)) return (Number(va) - Number(vb)) * sort.dir;
    return va.toString().localeCompare(vb.toString(), "ja") * sort.dir;
  });

  const totalItems = sorted.length;
  const pageRows   = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const summary    = groupSummary(sorted);
  const arrow = (col) => sort.col === col ? (sort.dir > 0 ? " ↑" : " ↓") : "";

  const TH = ({ col, label, right }) => (
    <th
      className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-outline cursor-pointer
                  hover:text-on-surface-variant transition-colors select-none whitespace-nowrap
                  ${right ? "text-right" : "text-left"}`}
      onClick={() => handleSort(col)}
    >{label}{arrow(col)}</th>
  );

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
      {/* Panel header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${accent.dot}`} />
          <h4 className="text-sm font-bold text-on-surface truncate">{processName} Process</h4>
          <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-bold text-outline flex-shrink-0">
            {totalItems}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {summary.length > 0 && (
            <button
              onClick={() => {
                setShowSummary(true);
                setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }}
              className="text-[11px] text-outline hover:text-on-surface transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>expand_more</span>
              Summary
            </button>
          )}
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-7 px-2.5 rounded-lg bg-surface-container border border-white/10 text-[11px]
                       text-on-surface placeholder:text-outline outline-none focus:border-primary/40 w-28 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-surface-container-high/40 sticky top-0">
            <tr>
              <TH col="品番"             label="品番" />
              <TH col="背番号"           label="背番号" />
              <TH col="Worker_Name"      label="作業者" />
              <TH col="Date"             label="日付" />
              <TH col="Process_Quantity" label="Total"   right />
              <TH col="Total_NG"         label="Total NG" right />
              <TH col="Work_Hours"       label="稼働時間" right />
              <TH col="Defect_Rate"      label="不良率"   right />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-outline text-xs">
                  {search ? "No results match your search" : "No data available"}
                </td>
              </tr>
            ) : pageRows.map((r, i) => {
              const qty     = Number(r.Process_Quantity) || Number(r.Total) || 0;
              const ng      = Number(r.Total_NG) || 0;
              const defRate = qty > 0 ? ((ng / qty) * 100).toFixed(2) : "0.00";
              const hrs     = calcWorkHours(r.Time_start, r.Time_end);
              return (
                <tr
                  key={i}
                  className="hover:bg-primary/10 hover:shadow-[inset_3px_0_0_rgb(var(--c-primary))] cursor-pointer transition-all duration-150"
                  onClick={() => onRowClick(r, processName)}
                >
                  <td className="px-4 py-2.5 font-bold text-on-surface">{r["品番"] ?? "—"}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{r["背番号"] ?? "—"}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{r.Worker_Name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-outline whitespace-nowrap">{r.Date ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-on-surface">{qty.toLocaleString()}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${ng > 0 ? "text-error" : "text-outline"}`}>{ng}</td>
                  <td className="px-4 py-2.5 text-right text-on-surface-variant whitespace-nowrap">
                    {hrs != null ? `${hrs.toFixed(2)}h` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${defectChip(defRate)}`}>
                      {defRate}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination total={totalItems} page={page} onPage={setPage} />

      {/* Summary collapsible */}
      {summary.length > 0 && (
        <div ref={summaryRef} className="border-t border-white/10">
          <button
            className="w-full px-5 py-3 flex items-center gap-2 text-xs font-bold text-outline hover:text-on-surface transition-colors"
            onClick={() => setShowSummary((v) => !v)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {showSummary ? "keyboard_arrow_up" : "keyboard_arrow_down"}
            </span>
            Daily Summary ({summary.length} parts)
          </button>
          {showSummary && (
            <div className="px-5 pb-4 overflow-x-auto">
              <table className="w-full min-w-[400px] text-xs">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-outline">
                    <th className="text-left pb-2 pr-6">品番</th>
                    <th className="text-left pb-2 pr-6">背番号</th>
                    <th className="text-right pb-2 pr-6">Total</th>
                    <th className="text-right pb-2 pr-6">Total NG</th>
                    <th className="text-right pb-2">不良率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summary.map((s, i) => {
                    const rate = s.total > 0 ? ((s.ng / s.total) * 100).toFixed(2) : "0.00";
                    return (
                      <tr key={i} className="hover:bg-surface-container/40 transition-colors">
                        <td className="py-2 pr-6 font-bold text-on-surface">{s.hinban ?? "—"}</td>
                        <td className="py-2 pr-6 text-on-surface-variant">{s.sebanggo ?? "—"}</td>
                        <td className="py-2 pr-6 text-right text-on-surface">{s.total.toLocaleString()}</td>
                        <td className={`py-2 pr-6 text-right font-bold ${s.ng > 0 ? "text-error" : "text-outline"}`}>{s.ng}</td>
                        <td className="py-2 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${defectChip(rate)}`}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
