import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchProductionByPeriod,
  fetchSensorData,
  fetchEnvironmentalData,
  checkMaterialSebanggo,
  lookupMaterialLot,
  query,
} from "../services/api";
import { getDefectStatus, getTempStatus, getHumidityStatus, getWBGTStatus } from "../utils/statusHelpers";

// ─── Constants ────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 25;
const PROCESS_ACCENT = {
  Kensa: { dot: "bg-amber-400",   label: "text-amber-400" },
  Press: { dot: "bg-emerald-400", label: "text-emerald-400" },
  SRS:   { dot: "bg-slate-400",   label: "text-slate-400" },
  Slit:  { dot: "bg-sky-400",     label: "text-sky-400" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) { return d.toISOString().split("T")[0]; }
function todayStr() { return fmtDate(new Date()); }

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

function parseLotDate(lot) {
  const m = String(lot).match(/^(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${2000 + parseInt(m[1], 10)}-${m[2]}-${m[3]}`;
}

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
const SORT_NUMERIC = new Set(["Total","Total_NG","Process_Quantity","Remaining_Quantity","Cycle_Time"]);

function ProcessPanel({ processName, rows, onRowClick }) {
  const accent = PROCESS_ACCENT[processName] ?? PROCESS_ACCENT.Kensa;
  const [sort, setSort]           = useState({ col: null, dir: 1 });
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
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
              <TH col="品番"            label="品番" />
              <TH col="背番号"          label="背番号" />
              <TH col="Worker_Name"     label="作業者" />
              <TH col="Date"            label="日付" />
              <TH col="Process_Quantity" label="Total"    right />
              <TH col="Total_NG"        label="Total NG"  right />
              <TH col="Work_Hours"      label="稼働時間"  right />
              <TH col="Defect_Rate"     label="不良率"    right />
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
                  className="hover:bg-surface-container/50 cursor-pointer transition-colors"
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

// ─── DetailModal ──────────────────────────────────────────────────────────────
function DetailModal({ record, processName, onClose }) {
  if (!record) return null;

  const qty     = Number(record.Process_Quantity) || Number(record.Total) || 0;
  const ng      = Number(record.Total_NG) || 0;
  const defRate = qty > 0 ? ((ng / qty) * 100).toFixed(2) : "0.00";
  const hrs     = calcWorkHours(record.Time_start, record.Time_end);

  const SKIP   = new Set(["_id", "_source", "__v"]);
  const entries = Object.entries(record).filter(([k]) => !SKIP.has(k) && record[k] != null && record[k] !== "");

  const defColor = parseFloat(defRate) > 2 ? "text-error" : parseFloat(defRate) > 1 ? "text-amber-400" : "text-emerald-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto
                   shadow-[0_0_60px_rgba(99,102,241,0.15)] scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 glass-card rounded-t-3xl px-6 py-5 flex items-center justify-between border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${PROCESS_ACCENT[processName]?.dot ?? "bg-primary"}`} />
              <h3 className="text-base font-bold text-on-surface">{processName} Process — Record Details</h3>
            </div>
            <p className="text-[11px] text-outline mt-0.5 font-mono">{record["品番"]} / {record["背番号"]}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-white/10">
          {[
            { label: "Total", value: qty.toLocaleString(), color: "text-on-surface" },
            { label: "Total NG", value: ng, color: ng > 0 ? "text-error" : "text-on-surface" },
            { label: "不良率", value: `${defRate}%`, color: defColor },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card rounded-xl px-4 py-3 text-center">
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-[10px] font-bold text-outline uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Key metrics */}
        <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-white/10">
          {[
            ["工場",     record["工場"]],
            ["Date",     record.Date],
            ["作業者",   record.Worker_Name],
            ["設備",     record["設備"]],
            ["開始時刻", record.Time_start],
            ["終了時刻", record.Time_end],
            ["稼働時間", hrs != null ? `${hrs.toFixed(2)} hrs` : null],
            ["製造ロット", record["製造ロット"]],
            ["材料ロット", record["材料ロット"]],
          ].filter(([, v]) => v != null).map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</span>
              <span className="text-sm font-bold text-on-surface">{value}</span>
            </div>
          ))}
        </div>

        {/* All fields */}
        <div className="px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-3">All Fields</p>
          <div className="space-y-0">
            {entries.map(([k, v]) => {
              let display = v;
              if (typeof v === "object") {
                try { display = JSON.stringify(v, null, 2); } catch { display = String(v); }
              }
              const isImage = typeof v === "string" && /\.(png|jpg|jpeg|gif|webp)$/i.test(v);
              return (
                <div key={k} className="flex justify-between gap-4 py-2 border-b border-white/5 last:border-0">
                  <span className="text-[11px] font-bold text-outline flex-shrink-0">{k}</span>
                  {isImage ? (
                    <img src={v} alt={k} className="max-h-24 rounded-lg" />
                  ) : (
                    <span className="text-xs text-on-surface-variant text-right break-all font-mono">{String(display)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MfgLotModal ─────────────────────────────────────────────────────────────
function MfgLotModal({ onClose }) {
  const [lotInput, setLotInput]   = useState("");
  const [step, setStep]           = useState("input");
  const [sebanggoOptions, setSebanggoOptions] = useState([]);
  const [results, setResults]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [errMsg, setErrMsg]       = useState("");

  const handleSearch = async () => {
    const lot = lotInput.trim();
    if (lot.length < 3) return;
    setLoading(true);
    setErrMsg("");
    try {
      const check = await checkMaterialSebanggo(lot);
      if (check?.multiple && Array.isArray(check.options) && check.options.length > 1) {
        setSebanggoOptions(check.options);
        setStep("selecting");
      } else {
        const res = await lookupMaterialLot(lot, check?.sebanggo ?? null);
        setResults(res);
        setStep("results");
      }
    } catch {
      // Fallback: search pressDB by 製造ロット regex
      try {
        const rows = await query("submittedDB", "pressDB", { "製造ロット": { $regex: lot, $options: "i" } });
        setResults({ rows });
        setStep("results");
      } catch {
        setErrMsg("Lot not found. Please check the number and try again.");
        setStep("error");
      }
    }
    setLoading(false);
  };

  const handleSelectSebanggo = async (seb) => {
    setLoading(true);
    try {
      const res = await lookupMaterialLot(lotInput.trim(), seb);
      setResults(res);
      setStep("results");
    } catch {
      setErrMsg("Failed to retrieve lot data.");
      setStep("error");
    }
    setLoading(false);
  };

  const rows   = results?.rows ?? (Array.isArray(results) ? results : []);
  const fields = (results && !Array.isArray(results) && !results.rows)
    ? Object.entries(results).filter(([k]) => k !== "rows")
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card rounded-3xl w-full max-w-xl max-h-[85vh] overflow-y-auto
                   shadow-[0_0_60px_rgba(99,102,241,0.15)] scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>manage_search</span>
            <h3 className="text-base font-bold text-on-surface">Manufacturing Lot Finder</h3>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={lotInput}
              onChange={(e) => setLotInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="製造ロット番号 (例: 241227)"
              className="flex-1 h-10 px-3 rounded-xl bg-surface-container border border-white/10 text-sm
                         text-on-surface placeholder:text-outline outline-none focus:border-primary/40 transition-colors"
            />
            <button
              onClick={handleSearch}
              disabled={loading || lotInput.trim().length < 3}
              className="px-4 h-10 rounded-xl kinetic-gradient text-white text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {loading ? "…" : "Search"}
            </button>
          </div>

          {step === "selecting" && (
            <div>
              <p className="text-xs text-on-surface-variant mb-3">Multiple matches — select a serial number:</p>
              <div className="space-y-2">
                {sebanggoOptions.map((s) => (
                  <button key={s} onClick={() => handleSelectSebanggo(s)}
                    className="w-full px-4 py-3 rounded-xl glass-card text-left text-sm font-bold text-on-surface
                               hover:border-primary/30 hover:scale-[1.01] transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "results" && (
            <div className="space-y-3">
              {fields.length > 0 && (
                <div className="glass-card rounded-xl p-4 space-y-2">
                  {fields.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
                      <span className="text-[11px] font-bold text-outline">{k}</span>
                      <span className="text-xs text-on-surface-variant text-right font-mono">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
              {rows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-container-high/50">
                      <tr>
                        {["品番","背番号","Date","Total","Total NG","不良率"].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-outline">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {rows.map((r, i) => {
                        const qty = Number(r.Process_Quantity) || Number(r.Total) || 0;
                        const ng  = Number(r.Total_NG) || 0;
                        const dr  = qty > 0 ? ((ng / qty) * 100).toFixed(2) : "0.00";
                        return (
                          <tr key={i} className="hover:bg-surface-container/40 transition-colors">
                            <td className="px-4 py-2.5 font-bold text-on-surface">{r["品番"] ?? "—"}</td>
                            <td className="px-4 py-2.5 text-on-surface-variant">{r["背番号"] ?? "—"}</td>
                            <td className="px-4 py-2.5 text-outline">{r.Date ?? "—"}</td>
                            <td className="px-4 py-2.5 text-on-surface">{qty.toLocaleString()}</td>
                            <td className={`px-4 py-2.5 font-bold ${ng > 0 ? "text-error" : "text-outline"}`}>{ng}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${defectChip(dr)}`}>{dr}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : fields.length === 0 && (
                <p className="text-sm text-outline text-center py-4">No records found for this lot.</p>
              )}
            </div>
          )}

          {step === "error" && (
            <p className="text-sm text-error text-center py-2">{errMsg}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FactoryDetailPage() {
  const { factoryName: encoded } = useParams();
  const factoryName = decodeURIComponent(encoded);
  const navigate    = useNavigate();

  const [dateFrom,      setDateFrom]      = useState(todayStr());
  const [dateTo,        setDateTo]        = useState(todayStr());
  const [partNumbers,   setPartNumbers]   = useState([]);
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [advancedOpen,  setAdvancedOpen]  = useState(false);

  const [prodData,      setProdData]      = useState(null);
  const [sensor,        setSensor]        = useState(null);
  const [env,           setEnv]           = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [activeSection, setActiveSection] = useState("Daily");

  const [selectedRecord,  setSelectedRecord]  = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [showLotModal,    setShowLotModal]    = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [p, s, e] = await Promise.allSettled([
      fetchProductionByPeriod(factoryName, dateFrom, dateTo, partNumbers, serialNumbers),
      fetchSensorData(factoryName, dateFrom),
      fetchEnvironmentalData(factoryName),
    ]);
    if (p.status === "fulfilled") {
      setProdData(p.value);
      setActiveSection(Object.keys(p.value.sections)[0]);
    }
    if (s.status === "fulfilled") setSensor(s.value);
    if (e.status === "fulfilled") setEnv(e.value);
    setLoading(false);
  }, [factoryName, dateFrom, dateTo, partNumbers, serialNumbers]);

  // Load on mount
  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sections     = prodData?.sections ?? {};
  const sectionNames = Object.keys(sections);
  const currentRows  = sections[activeSection] ?? {};

  // Summary stats from the first (most granular) section
  const firstSection = sections[sectionNames[0]] ?? {};
  const allFlat      = Object.values(firstSection).flat();
  const stripTotal   = allFlat.reduce((s, r) => s + (Number(r.Process_Quantity) || Number(r.Total) || 0), 0);
  const stripNG      = allFlat.reduce((s, r) => s + (Number(r.Total_NG) || 0), 0);
  const stripRate    = stripTotal > 0 ? Math.round((stripNG / stripTotal) * 10000) / 100 : 0;
  const defStatus    = getDefectStatus(stripRate);

  return (
    <section className="pt-24 pb-20 px-4 md:px-8 overflow-y-auto h-screen scrollbar-hide">

      {/* ── Page header ── */}
      <div className="flex items-start gap-4 mb-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-primary transition-colors mt-1"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-3xl font-black tracking-tight text-on-surface font-headline">{factoryName}</h2>
            {!loading && (
              <span className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full ${defStatus.bg} ${defStatus.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${defStatus.dot}`} />
                {defStatus.label}
              </span>
            )}
          </div>
          <p className="text-on-surface-variant text-sm mt-1">
            Factory Overview —&nbsp;
            {dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`}
          </p>
        </div>
        <button
          onClick={() => navigate(`/sensors/${encoded}`)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold
                     kinetic-gradient text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sensors</span>
          Sensor History
        </button>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Units",    value: loading ? "—" : stripTotal.toLocaleString(),      color: "text-on-surface"   },
          { label: "NG Units",       value: loading ? "—" : stripNG.toLocaleString(),          color: "text-error"        },
          { label: "Defect Rate",    value: loading ? "—" : `${stripRate.toFixed(2)}%`,        color: defStatus.valueColor ?? "text-on-surface" },
          { label: "Sensors Online", value: loading ? "—" : (sensor?.sensorCount ?? 0),        color: sensor?.hasData ? "text-emerald-400" : "text-outline" },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card rounded-2xl px-5 py-4 flex flex-col gap-1">
            <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
            <p className="text-xs font-bold text-on-surface-variant">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Env / sensor strip ── */}
      {(env || sensor?.hasData) && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {env && (
            <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-5">
              <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 24 }}>cloud</span>
              <div className="flex gap-6 flex-wrap flex-1">
                {[
                  { label: "Temp",     value: `${env.temperature ?? "—"}°C`, status: getTempStatus(env.temperature) },
                  { label: "Humidity", value: `${env.humidity ?? "—"}%`,     status: getHumidityStatus(env.humidity) },
                ].map(({ label, value, status }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</span>
                    <span className={`text-base font-black ${status.color}`}>{value}</span>
                  </div>
                ))}
              </div>
              {env.isDefault && <span className="text-[10px] text-outline">Simulated</span>}
            </div>
          )}
          {sensor?.hasData && (
            <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-5">
              <span className="material-symbols-outlined text-tertiary flex-shrink-0" style={{ fontSize: 24 }}>sensors</span>
              <div className="flex gap-6 flex-wrap">
                {[
                  { label: "Peak Temp",    value: `${sensor.highestTemp}°C`,      status: getTempStatus(sensor.highestTemp) },
                  { label: "Avg Humidity", value: `${sensor.averageHumidity}%`,   status: getHumidityStatus(sensor.averageHumidity) },
                  ...(sensor.wbgt != null ? [{ label: "WBGT", value: `${sensor.wbgt}°C`, status: getWBGTStatus(sensor.wbgt) }] : []),
                ].map(({ label, value, status }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</span>
                    <span className={`text-base font-black ${status.color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-outline">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 px-3 rounded-xl bg-surface-container border border-white/10 text-sm text-on-surface outline-none focus:border-primary/40 transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-outline">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="h-10 px-3 rounded-xl bg-surface-container border border-white/10 text-sm text-on-surface outline-none focus:border-primary/40 transition-colors" />
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
        </div>

        {/* Advanced filters */}
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
            onClick={loadData}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl kinetic-gradient text-white text-sm font-bold
                       hover:opacity-90 disabled:opacity-50 transition-opacity shadow-[0_0_20px_rgba(99,102,241,0.25)]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
            {loading ? "Loading…" : "Apply Filters"}
          </button>
          <button
            onClick={() => setShowLotModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-card border border-white/10 text-sm font-bold
                       text-on-surface hover:border-primary/30 hover:scale-[1.02] transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>manage_search</span>
            Manufacturing Lot Finder
          </button>
        </div>
      </div>

      {/* ── Daily Production ── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>factory</span>
            Daily Production
          </h3>
          {sectionNames.length > 1 && (
            <div className="flex gap-1 p-1 rounded-xl bg-surface-container">
              {sectionNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveSection(name)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeSection === name
                      ? "kinetic-gradient text-white shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >{name}</button>
              ))}
            </div>
          )}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card rounded-2xl h-72 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {["Kensa", "Press", "SRS", "Slit"].map((proc) => (
                <ProcessPanel
                  key={`${activeSection}_${proc}`}
                  processName={proc}
                  rows={currentRows[proc] ?? []}
                  onRowClick={(record, pName) => {
                    setSelectedRecord(record);
                    setSelectedProcess(pName);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Record detail modal ── */}
      {selectedRecord && (
        <DetailModal
          record={selectedRecord}
          processName={selectedProcess}
          onClose={() => { setSelectedRecord(null); setSelectedProcess(null); }}
        />
      )}

      {/* ── Manufacturing lot modal ── */}
      {showLotModal && <MfgLotModal onClose={() => setShowLotModal(false)} />}
    </section>
  );
}
