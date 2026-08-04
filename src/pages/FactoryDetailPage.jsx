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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75"
      onClick={onClose}
    >
      <div
        className="dashboard-section rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 flex items-center justify-between border-b border-separator/40">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>manage_search</span>
            <h3 className="text-base font-semibold text-on-surface">材料ロット詳細 (Material Lot Finder)</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={hinbanInput}
              onChange={(e) => setHinbanInput(e.target.value)}
              placeholder="品番 (例: 12345-6789)"
              className="flex-1 h-10 px-3 rounded-xl bg-surface-container border border-separator/40 text-sm text-on-surface placeholder:text-outline outline-none focus:border-primary/40 transition-colors"
            />
            <input
              type="text"
              value={lotInput}
              onChange={(e) => setLotInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="材料ロット番号 (例: 260709-1)"
              className="flex-1 h-10 px-3 rounded-xl bg-surface-container border border-separator/40 text-sm text-on-surface placeholder:text-outline outline-none focus:border-primary/40 transition-colors"
            />
            <button
              onClick={handleSearch}
              disabled={loading || lotInput.trim().length < 3 || !hinbanInput.trim()}
              className="px-4 h-10 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {loading ? "…" : "Search"}
            </button>
          </div>

          {step === "selecting" && (
            <div>
              <p className="text-xs text-on-surface-variant mb-3">Multiple matches — select a 材料背番号 (Sebanggo):</p>
              <div className="space-y-2">
                {sebanggoOptions.map((s) => (
                  <button key={s} onClick={() => handleSelectSebanggo(s)} className="w-full px-4 py-3 rounded-xl glass-card text-left text-sm font-semibold text-on-surface hover:border-primary/30 hover:scale-[1.01] transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "results" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary/10 px-4 py-3 border border-primary/20 text-sm text-primary font-semibold">
                検索結果: {records.length}件 &nbsp;&nbsp;&nbsp; 材料背番号: {results?.材料背番号 ?? "—"}
              </div>
              
              {records.length > 0 ? (
                <div className="space-y-4">
                  {records.map((rec, i) => (
                    <div key={i} className="glass-card rounded-2xl overflow-hidden border border-separator/40">
                      <div className="px-5 py-3 bg-surface-container-high/40 border-b border-separator/40 flex items-center justify-between">
                        <span className="font-semibold text-sm">記録 #{i + 1}</span>
                        {rec.Status === "Completed" && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold">Completed</span>
                        )}
                      </div>
                      
                      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">品番:</span><span className="font-semibold">{rec["品番"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">生産数:</span><span className="font-semibold">{rec["生産数"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">材料品番:</span><span className="font-semibold">{rec["材料品番"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">生産順番:</span><span className="font-semibold">{rec["生産順番"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">材料背番号:</span><span className="font-semibold">{rec["材料背番号"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">作業時間:</span><span className="font-semibold">{rec["作業時間"] ? `${rec["作業時間"]} 時間` : "—"}</span></div>
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">作業日:</span><span className="font-semibold">{rec["作業日"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">人員数:</span><span className="font-semibold">{rec["人員数"] != null ? `${rec["人員数"]} 人` : "—"}</span></div>
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">納期:</span><span className="font-semibold">{rec["納期"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">幅:</span><span className="font-semibold">{rec["幅"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">工場:</span><span className="font-semibold">{rec["工場"] ?? "—"}</span></div>
                        <div className="flex justify-between border-b border-separator/20 pb-2"><span className="text-outline">型番:</span><span className="font-semibold">{rec["型番"] ?? "—"}</span></div>
                      </div>
                      
                      {rec.PrintLog && rec.PrintLog.length > 0 && (
                        <div className="p-5 pt-0">
                          <h4 className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1.5 mb-3 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-sm bg-primary" /> ロット情報
                          </h4>
                          <div className="space-y-2">
                            {rec.PrintLog.map((log, idx) => (
                              <div key={idx} className="bg-surface-container/30 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                                <div className="flex justify-between"><span className="text-outline">ロット番号:</span><span className="font-semibold break-all text-right max-w-[60%]">{log.lotNumbers?.join(", ") || "—"}</span></div>
                                <div className="flex justify-between"><span className="text-outline">印刷枚数:</span><span className="font-semibold">{log.quantity ? `${log.quantity}枚` : "—"}</span></div>
                                <div className="flex justify-between"><span className="text-outline">総印刷枚数:</span><span className="font-semibold">{log.totalPrintedSoFar ? `${log.totalPrintedSoFar}枚` : "—"}</span></div>
                                <div className="flex justify-between"><span className="text-outline">印刷者:</span><span className="font-semibold">{log.user ?? "—"}</span></div>
                                <div className="flex justify-between"><span className="text-outline">印刷日時:</span><span className="font-semibold">{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</span></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="p-5 pt-4 border-t border-separator/20 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div className="flex justify-between"><span className="text-outline">加工条件管理番号:</span><span className="font-semibold">{rec["加工条件管理番号"] ?? "—"}</span></div>
                        <div className="flex justify-between"><span className="text-outline">印刷日時:</span><span className="font-semibold">{rec.LastPrintTimestamp ? new Date(rec.LastPrintTimestamp).toLocaleString() : (rec["印刷日時"] ?? "—")}</span></div>
                        <div className="flex justify-between"><span className="text-outline">完了日時:</span><span className="font-semibold">{rec["完了日時"] ?? "—"}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
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
    <section className="pt-24 pb-20 px-4 md:px-8 overflow-y-auto h-screen scrollbar-hide">
      <PageHeader
        leading={(
          <button
            onClick={() => navigate(combined ? "/factories" : "/dashboard")}
            className="mt-1 p-2 rounded-xl hover:bg-surface-container text-outline hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        bodyClassName="items-start"
        title={pageTitle}
        titleMeta={!loading ? (
          <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded-full ${defStatus.bg} ${defStatus.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${defStatus.dot}`} />
            {defStatus.label}
          </span>
        ) : null}
        subtitle={`${combined ? "All Factories Combined -" : "Factory Overview -"} ${dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`}`}
        className="mb-6 md:flex-row md:items-start md:justify-between"
        actions={(
          <>
            {!combined && factoryName === "小瀬" && (
              <button
                onClick={() => setCameraModalOpen(true)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-separator/40 bg-surface text-on-surface hover:bg-surface-container hover:border-primary/30 hover:text-primary active:scale-95 transition-all duration-150"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>
                View Live Feed
              </button>
            )}

            <button
              onClick={() => navigate(combined ? "/sensors" : `/sensors/${encoded}`)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                         bg-primary text-on-primary hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sensors</span>
              {combined ? "Sensor Overview" : "Sensor History"}
            </button>
          </>
        )}
      />

      {/* ── Summary strip ── */}
      <div className="space-y-3 mb-6">
        {/* Row 1: overall */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {overviewSummaryCards.map((card) => (
            <StatSummaryCard
              key={card.key}
              icon={card.icon}
              label={card.label}
              value={card.value}
              subtitle={card.subtitle}
              accent={card.accent}
              loading={loading}
            />
          ))}
        </div>
        {/* Row 2: per-process */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {perProcess.map(({ proc, total, ng, rate, accent }) => {
            const ds = getDefectStatus(rate);
            return (
              <StatSummaryCard
                key={proc}
                icon="precision_manufacturing"
                label={`${proc} Process`}
                labelClassName={accent.color}
                value={total > 0 ? total.toLocaleString() : "—"}
                subtitle={
                  total > 0
                    ? <><span className={ds.valueColor}>{rate.toFixed(2)}%</span>{" · "}{ng.toLocaleString()} NG</>
                    : "No data"
                }
                subtitleClassName={total > 0 ? "text-on-surface-variant" : ""}
                accent={`${accent.color} ${accent.bg}`}
                loading={loading}
              />
            );
          })}
        </div>
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
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">{label}</span>
                    <span className={`text-base font-semibold ${status.color}`}>{value}</span>
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
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">{label}</span>
                    <span className={`text-base font-semibold ${status.color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {/* ── Daily Production ── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-separator/40 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>factory</span>
            Daily Production
          </h3>
          {sectionNames.length > 1 && (
            <LiquidSegmentedControl
              items={sectionNames}
              activeKey={activeSection}
              onChange={setActiveSection}
            />
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
        <CameraModal onClose={() => setCameraModalOpen(false)} />
      )}
    </section>
  );
}
