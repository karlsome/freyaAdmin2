import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Hls from "hls.js";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import CameraModal from "../components/CameraModal";
import PageHeader from "../components/PageHeader";
import {
  BASE_URL,
  fetchCombinedEnvironmentalData,
  fetchCombinedSensorData,
  fetchProductionByPeriod,
  fetchSensorData,
  fetchEnvironmentalData,
  checkMaterialSebanggo,
  lookupMaterialLot,
  query,
} from "../services/api";
import { getDefectStatus, getTempStatus, getHumidityStatus, getWBGTStatus } from "../utils/statusHelpers";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
import RecordDetailModal from "../components/RecordDetailModal";
import ProcessPanel from "../components/ProcessPanel";
import ProductionFilterBar from "../components/ProductionFilterBar";
import StatSummaryCard from "../components/StatSummaryCard";
import { useRecordModal } from "../hooks/useRecordModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) { return d.toISOString().split("T")[0]; }
function todayStr() { return fmtDate(new Date()); }

function defectChip(rate) {
  const n = parseFloat(rate);
  if (n > 2) return "bg-error/15 text-error";
  if (n > 1) return "bg-amber-400/15 text-amber-400";
  return "bg-emerald-400/15 text-emerald-400";
}

// ─── MfgLotModal ─────────────────────────────────────────────────────────────
function MfgLotModal({ onClose, initialLot = "", initialHinban = "" }) {
  const [lotInput, setLotInput]       = useState(initialLot);
  const [hinbanInput, setHinbanInput] = useState(initialHinban);
  const [step, setStep]               = useState("input");
  const [sebanggoOptions, setSebanggoOptions] = useState([]);
  const [results, setResults]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [errMsg, setErrMsg]           = useState("");

  const doSearch = useCallback(async (lot, hinban) => {
    if (!lot || lot.length < 3 || !hinban) {
      setErrMsg("品番 and 製造ロット are required.");
      return;
    }
    setLoading(true);
    setErrMsg("");
    try {
      const check = await checkMaterialSebanggo(hinban);
      if (check?.multiple && Array.isArray(check.材料背番号Array) && check.材料背番号Array.length > 1) {
        setSebanggoOptions(check.材料背番号Array);
        setStep("selecting");
      } else {
        const res = await lookupMaterialLot(hinban, lot, null);
        setResults(res);
        setStep("results");
      }
    } catch (e) {
      setErrMsg("Search failed. Please check the inputs and try again.");
      setStep("error");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const tLot = initialLot.trim();
    const tHinban = initialHinban.trim();
    if (tLot.length >= 3 && tHinban) {
      doSearch(tLot, tHinban);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => doSearch(lotInput.trim(), hinbanInput.trim());

  const handleSelectSebanggo = async (seb) => {
    setLoading(true);
    try {
      const res = await lookupMaterialLot(hinbanInput.trim(), lotInput.trim(), seb);
      setResults(res);
      setStep("results");
    } catch {
      setErrMsg("Failed to retrieve lot data.");
      setStep("error");
    }
    setLoading(false);
  };

  const records = results?.results ?? [];

  const modal = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="freya-card rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] w-full max-w-3xl max-h-[85vh] overflow-y-auto scrollbar-hide shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 20 }}>manage_search</span>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">材料ロット詳細 (Material Lot Finder)</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={hinbanInput}
              onChange={(e) => setHinbanInput(e.target.value)}
              placeholder="品番 (例: 12345-6789)"
              className="flex-1 h-9 px-3 rounded-[6px] bg-[var(--surface-subtle)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--freya-blue)] transition-colors font-mono"
            />
            <input
              type="text"
              value={lotInput}
              onChange={(e) => setLotInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="材料ロット番号 (例: 260709-1)"
              className="flex-1 h-9 px-3 rounded-[6px] bg-[var(--surface-subtle)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--freya-blue)] transition-colors font-mono"
            />
            <button
              onClick={handleSearch}
              disabled={loading || lotInput.trim().length < 3 || !hinbanInput.trim()}
              className="px-4 h-9 rounded-[6px] bg-[var(--freya-blue)] text-white text-xs font-semibold disabled:opacity-40 hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
            >
              {loading ? "…" : "Search"}
            </button>
          </div>

          {step === "selecting" && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-3">Multiple matches — select a 材料背番号 (Sebanggo):</p>
              <div className="space-y-2">
                {sebanggoOptions.map((s) => (
                  <button key={s} onClick={() => handleSelectSebanggo(s)} className="w-full px-4 py-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-left text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors font-mono">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "results" && (
            <div className="space-y-4">
              <div className="rounded-[6px] bg-[var(--freya-blue)]/10 px-4 py-2.5 border border-[var(--freya-blue)]/20 text-xs text-[var(--freya-blue)] font-bold font-mono">
                検索結果: {records.length}件 &nbsp;&nbsp;&nbsp; 材料背番号: {results?.材料背番号 ?? "—"}
              </div>
              
              {records.length > 0 ? (
                <div className="space-y-4">
                  {records.map((rec, i) => (
                    <div key={i} className="freya-card rounded-[8px] overflow-hidden border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
                      <div className="px-4 py-2.5 bg-[var(--surface-subtle)] border-b border-[var(--border)] flex items-center justify-between">
                        <span className="font-bold text-xs text-[var(--text-primary)]">記録 #{i + 1}</span>
                        {rec.Status === "Completed" && (
                          <span className="px-2 py-0.5 rounded-[4px] bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">Completed</span>
                        )}
                      </div>
                      
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">品番:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["品番"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">生産数:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["生産数"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">材料品番:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["材料品番"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">生産順番:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["生産順番"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">材料背番号:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["材料背番号"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">作業時間:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["作業時間"] ? `${rec["作業時間"]} 時間` : "—"}</span></div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">作業日:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["作業日"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">人員数:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["人員数"] != null ? `${rec["人員数"]} 人` : "—"}</span></div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">納期:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["納期"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">幅:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["幅"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">工場:</span><span className="font-bold text-[var(--text-primary)]">{rec["工場"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-1.5"><span className="text-[var(--text-muted)] font-mono">型番:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["型番"] ?? "—"}</span></div>
                      </div>
                      
                      {rec.PrintLog && rec.PrintLog.length > 0 && (
                        <div className="p-4 pt-0">
                          <h4 className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-1.5 mb-2.5 uppercase tracking-wider font-mono">
                            <span className="w-1.5 h-1.5 rounded-sm bg-[var(--freya-blue)]" /> ロット情報
                          </h4>
                          <div className="space-y-2">
                            {rec.PrintLog.map((log, idx) => (
                              <div key={idx} className="bg-[var(--surface-subtle)] border border-[var(--border)] rounded-[6px] p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-mono">
                                <div className="flex justify-between"><span className="text-[var(--text-muted)]">ロット番号:</span><span className="font-bold text-[var(--text-primary)] break-all text-right max-w-[60%]">{log.lotNumbers?.join(", ") || "—"}</span></div>
                                <div className="flex justify-between"><span className="text-[var(--text-muted)]">印刷枚数:</span><span className="font-bold text-[var(--text-primary)]">{log.quantity ? `${log.quantity}枚` : "—"}</span></div>
                                <div className="flex justify-between"><span className="text-[var(--text-muted)]">総印刷枚数:</span><span className="font-bold text-[var(--text-primary)]">{log.totalPrintedSoFar ? `${log.totalPrintedSoFar}枚` : "—"}</span></div>
                                <div className="flex justify-between"><span className="text-[var(--text-muted)]">印刷者:</span><span className="font-bold text-[var(--text-primary)]">{log.user ?? "—"}</span></div>
                                <div className="flex justify-between"><span className="text-[var(--text-muted)]">印刷日時:</span><span className="font-bold text-[var(--text-primary)]">{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</span></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="p-4 pt-3 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div className="flex justify-between"><span className="text-[var(--text-muted)] font-mono">加工条件管理番号:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["加工条件管理番号"] ?? "—"}</span></div>
                        <div className="flex justify-between"><span className="text-[var(--text-muted)] font-mono">印刷日時:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec.LastPrintTimestamp ? new Date(rec.LastPrintTimestamp).toLocaleString() : (rec["印刷日時"] ?? "—")}</span></div>
                        <div className="flex justify-between"><span className="text-[var(--text-muted)] font-mono">完了日時:</span><span className="font-bold text-[var(--text-primary)] font-mono">{rec["完了日時"] ?? "—"}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">No records found for this lot.</p>
              )}
            </div>
          )}

          {step === "error" && (
            <p className="text-xs text-error text-center py-2">{errMsg}</p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ─── Main page ────────────────────────────────────────────────────────────────
console.log('API URL:', import.meta.env.VITE_API_URL);
// ─── Main page ────────────────────────────────────────────────────────────────
export default function FactoryDetailPage({ combined = false }) {
  const { factoryName: encoded } = useParams();
  const factoryName = combined ? "__all__" : decodeURIComponent(encoded);
  const pageTitle = combined ? "Overview" : factoryName;
  const navigate    = useNavigate();
  const location    = useLocation();
  const hasAutoOpened = useRef(false);
  
  const searchParams = new URLSearchParams(location.search);
  const initialDateFrom = searchParams.get("dateFrom") || todayStr();
  const initialDateTo   = searchParams.get("dateTo") || todayStr();
  const initialSebanggo = searchParams.get("sebanggo") || "";

  const storageKey = `freyaAdmin2.factoryFilter.${factoryName}`;
  const getStoredFilters = () => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      // ignore
    }
    return {};
  };

  const storedFilters = getStoredFilters();
  const [dateFrom,      setDateFrom]      = useState(initialDateFrom !== todayStr() ? initialDateFrom : (storedFilters.dateFrom || initialDateFrom));
  const [dateTo,        setDateTo]        = useState(initialDateTo !== todayStr() ? initialDateTo : (storedFilters.dateTo || initialDateTo));
  const [partNumbers,   setPartNumbers]   = useState(storedFilters.partNumbers || []);
  const [serialNumbers, setSerialNumbers] = useState(initialSebanggo ? [initialSebanggo] : (storedFilters.serialNumbers || []));
  const [advancedFilters, setAdvancedFilters] = useState(storedFilters.advancedFilters || []);

  const [prodData,      setProdData]      = useState(null);
  const [sensor,        setSensor]        = useState(null);
  const [env,           setEnv]           = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [activeSection, setActiveSection] = useState("Daily");

  const { modalRecord, modalProcess, openRecord, closeRecord } = useRecordModal();
  const [showLotModal,    setShowLotModal]    = useState(false);
  const [lotModalInitial, setLotModalInitial] = useState({ lot: "", hinban: "" });

  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const loadData = useCallback(async (from = dateFrom, to = dateTo, parts = partNumbers, serials = serialNumbers, filters = advancedFilters) => {
    setLoading(true);
    const [p, s, e] = await Promise.allSettled([
      fetchProductionByPeriod(combined ? null : factoryName, from, to, parts, serials, filters),
      combined ? fetchCombinedSensorData(from) : fetchSensorData(factoryName, from),
      combined ? fetchCombinedEnvironmentalData() : fetchEnvironmentalData(factoryName),
    ]);
    if (p.status === "fulfilled") {
      setProdData(p.value);
      setActiveSection(Object.keys(p.value.sections)[0]);
    }
    if (s.status === "fulfilled") setSensor(s.value);
    if (e.status === "fulfilled") setEnv(e.value);
    setLoading(false);
  }, [combined, factoryName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load on mount
  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto open modal if autoOpen=true
  useEffect(() => {
    if (prodData && searchParams.get("autoOpen") === "true" && !hasAutoOpened.current && initialSebanggo) {
      hasAutoOpened.current = true;
      const daily = prodData.sections?.["Daily"] || {};
      let found = null;
      let foundProcess = "";
      for (const [procName, rows] of Object.entries(daily)) {
        const match = rows.find((r) => r["背番号"] === initialSebanggo);
        if (match) {
          found = match;
          foundProcess = procName;
          break;
        }
      }
      if (found) {
        openRecord(found, foundProcess);
      }
    }
  }, [prodData, searchParams, initialSebanggo, openRecord]);

  const sections     = prodData?.sections ?? {};
  const sectionNames = Object.keys(sections);
  const currentRows  = sections[activeSection] ?? {};

  // Summary stats from the first (most granular) section
  const firstSection = sections[sectionNames[0]] ?? {};
  const allFlat      = Object.values(firstSection).flat();
  const stripTotal   = allFlat.reduce((s, r) => s + (Number(r.Process_Quantity) || Number(r.Total) || 0), 0);
  const stripNG      = allFlat.reduce((s, r) => s + (Number(r.SRS_Total_NG) || Number(r.Total_NG) || 0), 0);
  const stripRate    = stripTotal > 0 ? Math.round((stripNG / stripTotal) * 10000) / 100 : 0;
  const defStatus    = getDefectStatus(stripRate);

  // Per-process stats
  const PROCESS_ACCENT = {
    Kensa: { color: "text-violet-500", bg: "bg-violet-500/10" },
    Press: { color: "text-sky-500", bg: "bg-sky-500/10" },
    SRS: { color: "text-amber-500", bg: "bg-amber-500/10" },
    Slit: { color: "text-emerald-500", bg: "bg-emerald-500/10" },
  };
  const perProcess = ["Kensa", "Press", "SRS", "Slit"].map((proc) => {
    const rows  = (firstSection[proc] ?? []);
    const total = rows.reduce((s, r) => s + (Number(r.Process_Quantity) || Number(r.Total) || 0), 0);
    const ng    = rows.reduce((s, r) => s + (Number(r.SRS_Total_NG) || Number(r.Total_NG) || 0), 0);
    const rate  = total > 0 ? Math.round((ng / total) * 10000) / 100 : 0;
    return { proc, total, ng, rate, accent: PROCESS_ACCENT[proc] ?? { color: "text-primary", bg: "bg-primary/10" } };
  });

  const overviewSummaryCards = [
    {
      key: "total-processed",
      icon: "output",
      label: "Total Processed",
      value: stripTotal.toLocaleString(),
      subtitle: "units processed",
      accent: "text-primary bg-primary/10",
    },
    {
      key: "ng-units",
      icon: "report",
      label: "NG Units",
      value: stripNG.toLocaleString(),
      subtitle: "defective units",
      accent: stripNG > 0 ? "text-error bg-error/10" : "text-emerald-500 bg-emerald-500/10",
    },
    {
      key: "defect-rate",
      icon: "percent",
      label: "Defect Rate",
      value: `${stripRate.toFixed(2)}%`,
      subtitle: defStatus.label,
      accent:
        stripRate >= 2
          ? "text-error bg-error/10"
          : stripRate >= 1.5
            ? "text-amber-500 bg-amber-500/10"
            : "text-emerald-500 bg-emerald-500/10",
    },
    {
      key: "sensors",
      icon: "sensors",
      label: combined ? "Total Sensors" : "Sensors Online",
      value: String(sensor?.sensorCount ?? 0),
      subtitle: combined ? "connected sensors across factories" : "active sensor devices",
      accent: sensor?.hasData ? "text-emerald-500 bg-emerald-500/10" : "text-outline bg-surface-container-high",
    },
  ];

  return (
    <section className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border)]">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate(combined ? "/factories" : "/dashboard")}
            aria-label="Back"
            className="mt-1 w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="freya-title">{pageTitle}</h1>
              {!loading && (
                <span className={`freya-badge ${
                  defStatus.level === "normal" ? "freya-badge-normal" :
                  defStatus.level === "warning" ? "freya-badge-warning" : "freya-badge-defect"
                }`}>
                  <span className="freya-badge-dot" />
                  {defStatus.label}
                </span>
              )}
            </div>
            <p className="text-sm font-normal text-[var(--text-muted)] mt-1">
              {combined ? "All Facilities Consolidated" : "Facility Production & Telemetry"}
              {" · "}
              <span className="freya-tabular">{dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {!combined && (factoryName === "小瀬" || factoryName === "倉知") && (
            <button
              onClick={() => setCameraModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>videocam</span>
              View Live Feed
            </button>
          )}

          <button
            onClick={() => navigate(combined ? "/sensors" : `/sensors/${encoded}`)}
            className="inline-flex items-center gap-2 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sensors</span>
            {combined ? "Sensor Fleet" : "Sensor Telemetry"}
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="space-y-4 mb-6">
        {/* Row 1: overall metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatSummaryCard
            variant="freya"
            label="Total Processed"
            value={stripTotal.toLocaleString()}
            subtitle="Units produced across all lines"
            icon="output"
            loading={loading}
          />
          <StatSummaryCard
            variant="freya"
            label="Defect Units (NG)"
            value={stripNG.toLocaleString()}
            subtitle={stripNG > 0 ? "Requires quality review" : "Zero defects detected"}
            statusDot={stripNG > 0 ? "defect" : "complete"}
            icon="report"
            loading={loading}
          />
          <StatSummaryCard
            variant="freya"
            label="Defect Rate"
            value={`${stripRate.toFixed(2)}%`}
            subtitle={`${defStatus.label} threshold`}
            statusDot={stripRate >= 2 ? "defect" : stripRate >= 1 ? "warning" : "complete"}
            icon="percent"
            loading={loading}
          />
          <StatSummaryCard
            variant="freya"
            label={combined ? "Connected Sensors" : "Sensors Online"}
            value={String(sensor?.sensorCount ?? 0)}
            subtitle={sensor?.hasData ? "Live telemetry streaming" : "Active monitoring nodes"}
            statusDot={sensor?.hasData ? "complete" : undefined}
            icon="sensors"
            loading={loading}
          />
        </div>

        {/* Row 2: per-process telemetry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {perProcess.map(({ proc, total, ng, rate }) => (
            <StatSummaryCard
              key={proc}
              variant="freya"
              label={`${proc} Process`}
              value={total > 0 ? total.toLocaleString() : "—"}
              subtitle={
                total > 0
                  ? `${rate.toFixed(2)}% Defect · ${ng.toLocaleString()} NG`
                  : "No active production"
              }
              statusDot={total > 0 ? (rate >= 2 ? "defect" : rate >= 1 ? "warning" : "complete") : undefined}
              icon="precision_manufacturing"
              loading={loading}
            />
          ))}
        </div>
      </div>

      {/* ── Env / sensor telemetry widget ── */}
      {(env || sensor?.hasData) && !loading && (
        <div className="freya-card p-4 sm:p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 22 }}>thermostat</span>
            <div>
              <span className="freya-label">Facility Environmental Telemetry</span>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Real-time ambient & sensor diagnostics</p>
            </div>
          </div>

          <div className="flex items-center gap-6 sm:gap-8 flex-wrap">
            {env?.temperature != null && (
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Ambient Temp</span>
                <span className="text-base font-semibold text-[var(--text-primary)] freya-tabular">{env.temperature}°C</span>
              </div>
            )}
            {env?.humidity != null && (
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Humidity</span>
                <span className="text-base font-semibold text-[var(--text-primary)] freya-tabular">{env.humidity}%</span>
              </div>
            )}
            {sensor?.highestTemp != null && (
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Peak Sensor</span>
                <span className="text-base font-semibold text-[var(--text-primary)] freya-tabular">{sensor.highestTemp}°C</span>
              </div>
            )}
            {sensor?.averageHumidity != null && (
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Avg Humidity</span>
                <span className="text-base font-semibold text-[var(--text-primary)] freya-tabular">{sensor.averageHumidity}%</span>
              </div>
            )}
            {sensor?.wbgt != null && (
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">WBGT Heat Index</span>
                <span className="text-base font-semibold text-[var(--text-primary)] freya-tabular">{sensor.wbgt}°C</span>
              </div>
            )}
            {env?.isDefault && (
              <span className="text-[11px] font-medium text-[var(--text-muted)] px-2 py-0.5 rounded-[4px] bg-slate-100 dark:bg-slate-800">
                Simulated
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <ProductionFilterBar
        factoryName={combined ? "__all__" : factoryName}
        defaultDateFrom={dateFrom}
        defaultDateTo={dateTo}
        defaultPartNumbers={partNumbers}
        defaultSerialNumbers={serialNumbers}
        defaultAdvancedFilters={advancedFilters}
        loading={loading}
        onApply={({ dateFrom: f, dateTo: t, partNumbers: p, serialNumbers: s, advancedFilters: af }) => {
          setDateFrom(f); setDateTo(t); setPartNumbers(p); setSerialNumbers(s); setAdvancedFilters(af);
          window.localStorage.setItem(storageKey, JSON.stringify({ dateFrom: f, dateTo: t, partNumbers: p, serialNumbers: s, advancedFilters: af }));
          loadData(f, t, p, s, af);
        }}
        onReset={() => {
          const f = todayStr(), t = todayStr(), p = [], s = [], af = [];
          setDateFrom(f); setDateTo(t); setPartNumbers(p); setSerialNumbers(s); setAdvancedFilters(af);
          window.localStorage.removeItem(storageKey);
          loadData(f, t, p, s, af);
        }}
        onLotFinderOpen={() => {
          setLotModalInitial({ lot: "", hinban: "" });
          setShowLotModal(true);
        }}
      />

      {/* ── Production Runs ── */}
      <div className="freya-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 20 }}>table_chart</span>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)] leading-none">Production Runs</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">Detailed process logs and inspection outputs</p>
            </div>
          </div>

          {sectionNames.length > 1 && (
            <LiquidSegmentedControl
              items={sectionNames}
              activeKey={activeSection}
              onChange={setActiveSection}
            />
          )}
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="freya-card h-72 animate-pulse bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {["Kensa", "Press", "SRS", "Slit"].map((proc) => (
                <ProcessPanel
                  key={`${activeSection}_${proc}`}
                  processName={proc}
                  rows={currentRows[proc] ?? []}
                  showFactoryColumn={combined}
                  onRowClick={(record, pName) => {
                    openRecord(record, pName);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Record detail modal ── */}
      {modalRecord && (
        <RecordDetailModal
          record={modalRecord}
          processName={modalProcess}
          onClose={closeRecord}
          onUpdated={loadData}
          onLotClick={(lot) => { setLotModalInitial({ lot, hinban: modalRecord["品番"] || "" }); setShowLotModal(true); }}
        />
      )}

      {/* ── Manufacturing lot modal ── */}
      {showLotModal && (
        <MfgLotModal
          initialLot={lotModalInitial.lot}
          initialHinban={lotModalInitial.hinban}
          onClose={() => { setShowLotModal(false); setLotModalInitial({ lot: "", hinban: "" }); }}
        />
      )}

      {cameraModalOpen && (
        <CameraModal onClose={() => setCameraModalOpen(false)} factory={factoryName} />
      )}
    </section>
  );
}
