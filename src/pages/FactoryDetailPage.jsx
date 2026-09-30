import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import CameraModal from "../components/CameraModal";
import PageHeader from "../components/PageHeader";
import {
  BASE_URL,
  fetchCombinedEnvironmentalData,
  fetchCombinedSensorData,
  fetchProductionByPeriod,
  fetchFirstFactoryProductionByPeriod,
  fetchSensorData,
  fetchEnvironmentalData,
  checkMaterialSebanggo,
  lookupMaterialLot,
  query,
} from "../services/api";
import { getDefectStatus, getTempStatus, getHumidityStatus, getWBGTStatus } from "../utils/statusHelpers";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
import RecordDetailModal from "../components/RecordDetailModal";
import FirstFactoryDetailModal from "../components/FirstFactoryDetailModal";
import ProcessPanel from "../components/ProcessPanel";
import ProductionFilterBar from "../components/ProductionFilterBar";
import StatSummaryCard from "../components/StatSummaryCard";
import { useRecordModal } from "../hooks/useRecordModal";
import { useLanguage } from "../contexts/LanguageContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) { return d.toISOString().split("T")[0]; }
function todayStr() { return fmtDate(new Date()); }

function defectChip(rate) {
  const n = parseFloat(rate);
  if (n > 2) return "bg-error/15 text-error";
  if (n > 1) return "bg-amber-400/15 text-amber-400";
  return "bg-emerald-400/15 text-emerald-400";
}

const PROCESS_LABELS_JA = {
  Kensa: "検査工程",
  Press: "プレス工程",
  SRS: "SRS工程",
  Slit: "スリット工程",
};

const SECTION_LABELS_JA = {
  Daily: "日別",
  Weekly: "週別",
  Monthly: "月別",
};

// ─── MfgLotModal ─────────────────────────────────────────────────────────────
function MfgLotModal({ onClose, initialLot = "", initialHinban = "" }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [lotInput, setLotInput]       = useState(initialLot);
  const [hinbanInput, setHinbanInput] = useState(initialHinban);
  const [step, setStep]               = useState("input");
  const [sebanggoOptions, setSebanggoOptions] = useState([]);
  const [results, setResults]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [errMsg, setErrMsg]           = useState("");

  const doSearch = useCallback(async (lot, hinban) => {
    if (!lot || lot.length < 3 || !hinban) {
      setErrMsg(isJa ? "品番と製造ロットを入力してください。" : "品番 and 製造ロット are required.");
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
      setErrMsg(isJa ? "検索に失敗しました。入力内容を確認して再度お試しください。" : "Search failed. Please check the inputs and try again.");
      setStep("error");
    }
    setLoading(false);
  }, [isJa]);

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
      setErrMsg(isJa ? "ロットデータの取得に失敗しました。" : "Failed to retrieve lot data.");
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
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {isJa ? "材料ロット詳細" : "材料ロット詳細 (Material Lot Finder)"}
            </h3>
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
              {loading ? "…" : (isJa ? "検索" : "Search")}
            </button>
          </div>

          {step === "selecting" && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                {isJa ? "複数の候補が見つかりました — 材料背番号を選択してください:" : "Multiple matches — select a 材料背番号 (Sebanggo):"}
              </p>
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
                          <span className="px-2 py-0.5 rounded-[4px] bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                            {isJa ? "完了" : "Completed"}
                          </span>
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
                <p className="text-xs text-[var(--text-muted)] text-center py-4">
                  {isJa ? "このロットの記録は見つかりませんでした。" : "No records found for this lot."}
                </p>
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

// ─── Helpers for First Factory (PSA Process) ─────────────────────────────────
function prepareRollForModal(record, allPsaRecords = []) {
  if (!record) return { roll: null, allRolls: [] };

  if (Array.isArray(record.items) && record.items.length > 0) {
    const rolls = record.items.map((it, idx) => ({
      ...record,
      ...it,
      _id: it.id || `${record._id}_${idx}`,
      rollIndex: it.rollIndex ?? idx + 1,
      totalRolls: it.totalRolls ?? record.items.length,
      meters: it.meters ?? it.rollMeters ?? record.totalMeters,
      hinban: it.hinban || record.hinban,
      hinmei: it.hinmei || record.hinmei,
      kizai: it.kizai || record.kizai,
      machine: it.machine || record.machine || "PSA2",
      worker: it.worker || record.worker || "—",
      status: record.status || "completed",
    }));
    return { roll: rolls[0], allRolls: rolls };
  }

  let siblings = [];
  if (record.groupId) {
    siblings = allPsaRecords.filter((x) => x.groupId === record.groupId);
  } else if (record.date && record.hinban) {
    siblings = allPsaRecords.filter((x) => x.date === record.date && x.hinban === record.hinban);
  }
  if (!siblings.length) siblings = [record];

  return { roll: record, allRolls: siblings };
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FactoryDetailPage({ combined = false }) {
  const { language, t } = useLanguage();
  const isJa = language === "ja";
  const { factoryName: encoded } = useParams();
  const factoryName = combined ? "__all__" : decodeURIComponent(encoded);
  const isFirstFactory = !combined && (factoryName === "第一工場" || factoryName === "firstFactory");
  const pageTitle = combined ? (isJa ? "工場概要" : "Overview") : factoryName;
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

  // First Factory (PSA Process) dedicated states
  const [psaRecords, setPsaRecords] = useState([]);
  const [selectedPsaRoll, setSelectedPsaRoll] = useState(null);
  const [selectedPsaRollsList, setSelectedPsaRollsList] = useState([]);
  const [psaSearchTerm, setPsaSearchTerm] = useState("");
  const [psaStatusFilter, setPsaStatusFilter] = useState("all");

  const { modalRecord, modalProcess, openRecord, closeRecord } = useRecordModal();
  const [showLotModal,    setShowLotModal]    = useState(false);
  const [lotModalInitial, setLotModalInitial] = useState({ lot: "", hinban: "" });

  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const loadData = useCallback(async (from = dateFrom, to = dateTo, parts = partNumbers, serials = serialNumbers, filters = advancedFilters) => {
    setLoading(true);
    if (isFirstFactory) {
      const [pRes, sRes, eRes] = await Promise.allSettled([
        fetchFirstFactoryProductionByPeriod(from, to, parts, {
          advancedFilters: filters,
        }),
        fetchSensorData("第一工場", from),
        fetchEnvironmentalData("第一工場"),
      ]);
      if (pRes.status === "fulfilled") {
        setPsaRecords(pRes.value || []);
      }
      if (sRes.status === "fulfilled") setSensor(sRes.value);
      if (eRes.status === "fulfilled") setEnv(eRes.value);
      setLoading(false);
      return;
    }

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
  }, [combined, factoryName, isFirstFactory]);

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

  // Quick preset helper for date ranges
  const applyQuickDateRange = (preset) => {
    const today = new Date();
    let fromDate = new Date();
    let toDate = new Date();

    if (preset === "today") {
      // today
    } else if (preset === "7days") {
      fromDate.setDate(today.getDate() - 6);
    } else if (preset === "30days") {
      fromDate.setDate(today.getDate() - 29);
    } else if (preset === "thisMonth") {
      fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset === "prevMonth") {
      fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      toDate = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    const fStr = fmtDate(fromDate);
    const tStr = fmtDate(toDate);
    setDateFrom(fStr);
    setDateTo(tStr);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ dateFrom: fStr, dateTo: tStr, partNumbers, serialNumbers, advancedFilters })
    );
    loadData(fStr, tStr, partNumbers, serialNumbers, advancedFilters);
  };

  // PSA Stats Calculation
  const psaStats = useMemo(() => {
    let totalMeters = 0;
    let completedRolls = 0;
    let inProgressRolls = 0;
    let queuedRolls = 0;
    let totalRolls = 0;
    let manualCount = 0;

    (psaRecords || []).forEach((r) => {
      const m = Number(r.totalMeters) || Number(r.meters) || Number(r.rollMeters) || 0;
      totalMeters += m;
      const rolls = r.totalRolls || (Array.isArray(r.items) ? r.items.length : 1);
      totalRolls += rolls;

      const st = (r.status || "").toLowerCase();
      if (st === "completed") completedRolls += rolls;
      else if (st === "in-progress" || st === "active") inProgressRolls += rolls;
      else queuedRolls += rolls;

      if (r.manualAdvance || (Array.isArray(r.printHistory) && r.printHistory.some((p) => p.manualAdvance))) {
        manualCount++;
      }
    });

    const progressRate = totalRolls > 0 ? Math.round((completedRolls / totalRolls) * 100) : 0;
    return {
      totalMeters,
      totalRolls,
      completedRolls,
      inProgressRolls,
      queuedRolls,
      manualCount,
      progressRate,
    };
  }, [psaRecords]);

  // Filtered PSA Records for Table
  const filteredPsaRecords = useMemo(() => {
    if (!isFirstFactory) return [];
    let list = psaRecords || [];

    if (psaStatusFilter !== "all") {
      list = list.filter((r) => {
        const st = (r.status || "queue").toLowerCase();
        if (psaStatusFilter === "completed") return st === "completed";
        if (psaStatusFilter === "in-progress") return st === "in-progress" || st === "active";
        if (psaStatusFilter === "queue") return st === "queue" || st === "pending";
        return true;
      });
    }

    if (psaSearchTerm.trim()) {
      const term = psaSearchTerm.trim().toLowerCase();
      list = list.filter((r) => {
        const h = (r.hinban || "").toLowerCase();
        const lh = (r.labelHinban || "").toLowerCase();
        const k = (r.kizai || "").toLowerCase();
        const hm = (r.hinmei || "").toLowerCase();
        const w = (r.worker || "").toLowerCase();
        const m = (r.machine || "").toLowerCase();
        const lot = (r.lotNo || "").toLowerCase();
        const dest = (r.shippingDest || "").toLowerCase();
        return (
          h.includes(term) ||
          lh.includes(term) ||
          k.includes(term) ||
          hm.includes(term) ||
          w.includes(term) ||
          m.includes(term) ||
          lot.includes(term) ||
          dest.includes(term)
        );
      });
    }

    return list;
  }, [isFirstFactory, psaRecords, psaStatusFilter, psaSearchTerm]);

  const handleOpenPsaRoll = (rec) => {
    const { roll, allRolls } = prepareRollForModal(rec, psaRecords);
    setSelectedPsaRoll(roll);
    setSelectedPsaRollsList(allRolls);
  };

  const sections     = prodData?.sections ?? {};
  const sectionNames = Object.keys(sections);
  const currentRows  = sections[activeSection] ?? {};

  // Summary stats from the first (most granular) section
  const firstSection = sections[sectionNames[0]] ?? {};
  const allFlat      = Object.values(firstSection).flat();
  const stripTotal   = allFlat.reduce((s, r) => s + (Number(r.Process_Quantity) || Number(r.Total) || 0), 0);
  const stripNG      = allFlat.reduce((s, r) => s + (Number(r.SRS_Total_NG) || Number(r.Total_NG) || 0), 0);
  const stripRate    = stripTotal > 0 ? Math.round((stripNG / stripTotal) * 10000) / 100 : 0;
  const defStatus    = getDefectStatus(stripRate, isJa);

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

  return (
    <section className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border)]">
        <div className="flex items-start gap-3 flex-shrink-0">
          <button
            onClick={() => navigate("/factories")}
            aria-label={isJa ? "戻る" : "Back"}
            className="mt-1 w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="freya-title">{pageTitle}</h1>
              {!loading && (
                isFirstFactory ? (
                  <span className="freya-badge bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    PSA工程 (粘着・ラミネート)
                  </span>
                ) : (
                  <span className={`freya-badge ${
                    defStatus.level === "normal" ? "freya-badge-normal" :
                    defStatus.level === "warning" ? "freya-badge-warning" : "freya-badge-defect"
                  }`}>
                    <span className="freya-badge-dot" />
                    {defStatus.label}
                  </span>
                )
              )}
            </div>
            <p className="text-sm font-normal text-[var(--text-muted)] mt-1">
              {isFirstFactory
                ? (isJa ? "PSA工程 (粘着・ラミネート) 実績 & テレメトリ" : "PSA Adhesive Process History & Telemetry")
                : combined
                ? (isJa ? "全工場集約" : "All Facilities Consolidated")
                : (isJa ? "工場生産 & テレメトリ" : "Facility Production & Telemetry")}
              {" · "}
              <span className="freya-tabular">{dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-start lg:justify-end">
          {/* ── Facility Environmental Telemetry Strip ── */}
          {(env || sensor?.hasData) && !loading && (
            <div
              onClick={() => navigate(combined ? "/sensors" : `/sensors/${encoded}`)}
              title={isJa ? "センサテレメトリを表示" : "View Sensor Telemetry"}
              className="flex items-center gap-3 sm:gap-4 px-3 py-1.5 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border-strong)] cursor-pointer transition-colors shadow-2xs"
            >
              <div className="flex items-center gap-1.5 text-[var(--freya-blue)] pr-2 border-r border-[var(--border)] flex-shrink-0">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>thermostat</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hidden xl:inline">
                  {isJa ? "テレメトリ" : "Telemetry"}
                </span>
              </div>

              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                {env?.temperature != null && (
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] leading-tight">
                      {isJa ? "周囲温度" : "Ambient Temp"}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] freya-tabular leading-tight">
                      {env.temperature}°C
                    </span>
                  </div>
                )}
                {env?.humidity != null && (
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] leading-tight">
                      {isJa ? "湿度" : "Humidity"}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] freya-tabular leading-tight">
                      {env.humidity}%
                    </span>
                  </div>
                )}
                {sensor?.highestTemp != null && (
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] leading-tight">
                      {isJa ? "最高センサ温" : "Peak Sensor"}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] freya-tabular leading-tight">
                      {sensor.highestTemp}°C
                    </span>
                  </div>
                )}
                {sensor?.wbgt != null && (
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] leading-tight">
                      WBGT
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] freya-tabular leading-tight">
                      {sensor.wbgt}°C
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {isFirstFactory ? (
            <button
              onClick={() => navigate("/firstFactory")}
              className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
              title={isJa ? "生産計画・スケジュール管理へ移動" : "Go to Production Scheduler"}
            >
              <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>calendar_month</span>
              {isJa ? "生産計画・スケジュール" : "Production Scheduler"}
            </button>
          ) : (
            <>
              {!combined && (factoryName === "小瀬" || factoryName === "倉知") && (
                <button
                  onClick={() => setCameraModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>videocam</span>
                  {isJa ? "ライブ映像" : "View Live Feed"}
                </button>
              )}
            </>
          )}

          <button
            onClick={() => navigate(combined ? "/sensors" : `/sensors/${encoded}`)}
            className="inline-flex items-center gap-2 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sensors</span>
            {combined ? (isJa ? "センサ一覧" : "Sensor Fleet") : (isJa ? "センサテレメトリ" : "Sensor Telemetry")}
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="space-y-4 mb-6">
        {isFirstFactory ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatSummaryCard
              variant="freya"
              label={isJa ? "総生産長 (Total)" : "Total Output"}
              value={`${psaStats.totalMeters.toLocaleString()} m`}
              subtitle={isJa ? `${psaRecords.length} 件の実績ログ / 累計生産長` : `${psaRecords.length} log entries / total meters`}
              icon="straighten"
              loading={loading}
            />
            <StatSummaryCard
              variant="freya"
              label={isJa ? "総ロール数" : "Total Rolls"}
              value={`${psaStats.totalRolls.toLocaleString()} rolls`}
              subtitle={isJa ? `完了: ${psaStats.completedRolls} / 稼働中: ${psaStats.inProgressRolls}` : `Completed: ${psaStats.completedRolls} / Active: ${psaStats.inProgressRolls}`}
              icon="layers"
              loading={loading}
            />
            <StatSummaryCard
              variant="freya"
              label={isJa ? "完了進捗率" : "Progress Rate"}
              value={`${psaStats.progressRate}%`}
              subtitle={isJa ? `${psaStats.completedRolls} / ${psaStats.totalRolls} ロール完了` : `${psaStats.completedRolls} of ${psaStats.totalRolls} rolls done`}
              statusDot={psaStats.progressRate === 100 ? "complete" : psaStats.progressRate > 0 ? "warning" : undefined}
              icon="donut_large"
              loading={loading}
            />
            <StatSummaryCard
              variant="freya"
              label={isJa ? "手動進行 / 注意" : "Manual Advance"}
              value={`${psaStats.manualCount} 件`}
              subtitle={psaStats.manualCount > 0 ? (isJa ? "印刷不可など手動確認記録あり" : "Manual override records") : (isJa ? "手動進行なし" : "Zero manual overrides")}
              statusDot={psaStats.manualCount > 0 ? "defect" : "complete"}
              icon="tune"
              loading={loading}
            />
          </div>
        ) : (
          <>
            {/* Row 1: overall metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatSummaryCard
                variant="freya"
                label={isJa ? "総処理数" : "Total Processed"}
                value={stripTotal.toLocaleString()}
                subtitle={isJa ? "全ラインでの総生産数" : "Units produced across all lines"}
                icon="output"
                loading={loading}
              />
              <StatSummaryCard
                variant="freya"
                label={isJa ? "不良数 (NG)" : "Defect Units (NG)"}
                value={stripNG.toLocaleString()}
                subtitle={stripNG > 0 ? (isJa ? "品質確認が必要" : "Requires quality review") : (isJa ? "不良なし" : "Zero defects detected")}
                statusDot={stripNG > 0 ? "defect" : "complete"}
                icon="report"
                loading={loading}
              />
              <StatSummaryCard
                variant="freya"
                label={isJa ? "不良率" : "Defect Rate"}
                value={`${stripRate.toFixed(2)}%`}
                subtitle={isJa ? `${defStatus.label} 基準値` : `${defStatus.label} threshold`}
                statusDot={stripRate >= 2 ? "defect" : stripRate >= 1 ? "warning" : "complete"}
                icon="percent"
                loading={loading}
              />
              <StatSummaryCard
                variant="freya"
                label={combined ? (isJa ? "接続センサ数" : "Connected Sensors") : (isJa ? "稼働中センサ" : "Sensors Online")}
                value={String(sensor?.sensorCount ?? 0)}
                subtitle={combined ? (isJa ? "全工場の接続センサ" : "connected sensors across factories") : (sensor?.hasData ? (isJa ? "リアルタイム計測中" : "Live telemetry streaming") : (isJa ? "監視ノード待機中" : "Active monitoring nodes"))}
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
                  label={isJa ? (PROCESS_LABELS_JA[proc] || `${proc}工程`) : `${proc} Process`}
                  value={total > 0 ? total.toLocaleString() : "—"}
                  subtitle={
                    total > 0
                      ? (isJa ? `不良率: ${rate.toFixed(2)}% · ${ng.toLocaleString()} NG` : `${rate.toFixed(2)}% Defect · ${ng.toLocaleString()} NG`)
                      : (isJa ? "稼働実績なし" : "No active production")
                  }
                  statusDot={total > 0 ? (rate >= 2 ? "defect" : rate >= 1 ? "warning" : "complete") : undefined}
                  icon="precision_manufacturing"
                  loading={loading}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Quick Date Range Presets for First Factory ── */}
      {isFirstFactory && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs font-semibold text-[var(--text-muted)] mr-1">
            {isJa ? "期間クイック選択:" : "Quick Ranges:"}
          </span>
          {[
            { key: "today", label: isJa ? "今日" : "Today" },
            { key: "7days", label: isJa ? "過去7日" : "Last 7 Days" },
            { key: "30days", label: isJa ? "過去30日" : "Last 30 Days" },
            { key: "thisMonth", label: isJa ? "今月" : "This Month" },
            { key: "prevMonth", label: isJa ? "先月" : "Last Month" },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyQuickDateRange(preset.key)}
              className="px-2.5 py-1 rounded-[6px] text-xs font-semibold border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors shadow-2xs"
            >
              {preset.label}
            </button>
          ))}
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
            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 20 }}>
              {isFirstFactory ? "history_edu" : "table_chart"}
            </span>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)] leading-none">
                {isFirstFactory
                  ? (isJa ? "第一工場 PSA工程 (粘着・ラミネート) 製造履歴" : "First Factory PSA Process (Laminating) History")
                  : (isJa ? "製造実績" : "Production Runs")}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {isFirstFactory
                  ? (isJa ? `${dateFrom} 〜 ${dateTo} の実績一覧 (${filteredPsaRecords.length}件)` : `Historical production records from ${dateFrom} to ${dateTo} (${filteredPsaRecords.length} records)`)
                  : (isJa ? "工程別ログおよび検査実績の詳細" : "Detailed process logs and inspection outputs")}
              </p>
            </div>
          </div>

          {!isFirstFactory && sectionNames.length > 1 && (
            <LiquidSegmentedControl
              items={sectionNames.map((name) => ({
                key: name,
                label: name,
                labelJa: SECTION_LABELS_JA[name] || name,
              }))}
              activeKey={activeSection}
              onChange={setActiveSection}
            />
          )}

          {isFirstFactory && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-semibold text-[var(--freya-blue)] bg-[var(--freya-blue)]/10 border border-[var(--freya-blue)]/20 px-2.5 py-1 rounded-[6px]">
                {filteredPsaRecords.length} {isJa ? "件" : "records"} · {psaStats.totalMeters.toLocaleString()} m
              </span>
            </div>
          )}
        </div>

        {isFirstFactory ? (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Search and status filter pills */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none select-none"
                  style={{ fontSize: 18 }}
                >
                  search
                </span>
                <input
                  type="text"
                  value={psaSearchTerm}
                  onChange={(e) => setPsaSearchTerm(e.target.value)}
                  placeholder={isJa ? "品番、機材、ロット、作業者で検索…" : "Search by Hinban, Kizai, Lot, Worker…"}
                  className="freya-input h-9 w-full !pl-10 pr-8 text-xs text-[var(--text-primary)]"
                  style={{ paddingLeft: "2.5rem" }}
                />
                {psaSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setPsaSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center p-0.5"
                    aria-label={isJa ? "検索をクリア" : "Clear search"}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { key: "all", label: isJa ? "すべて" : "All", count: psaRecords.length },
                  { key: "completed", label: isJa ? "完了" : "Completed", count: psaStats.completedRolls },
                  { key: "in-progress", label: isJa ? "稼働中" : "In Progress", count: psaStats.inProgressRolls },
                  { key: "queue", label: isJa ? "待機" : "Queue", count: psaStats.queuedRolls },
                ].map((pill) => (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={() => setPsaStatusFilter(pill.key)}
                    className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                      psaStatusFilter === pill.key
                        ? "bg-[var(--text-primary)] text-[var(--surface)] shadow-xs"
                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 freya-tabular">
                      {pill.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 py-8">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-[6px] bg-[var(--surface-subtle)] animate-pulse border border-[var(--border)]" />
                ))}
              </div>
            ) : filteredPsaRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] text-center">
                <span className="material-symbols-outlined text-[var(--text-muted)] mb-2" style={{ fontSize: 44 }}>event_busy</span>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  {isJa ? "指定期間の第一工場（PSA工程）の生産履歴はありません" : "No PSA production records for this period"}
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md">
                  {isJa
                    ? `${dateFrom} 〜 ${dateTo} の間に記録されたPSA製造実績がありません。上のクイックボタンで「過去30日」または「今月」を選択するか、日付範囲を変更してください。`
                    : `No PSA records found between ${dateFrom} and ${dateTo}. Try selecting a wider date range or "Last 30 Days".`}
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => applyQuickDateRange("30days")}
                    className="px-3.5 py-1.5 rounded-[6px] bg-[var(--freya-blue)] text-white text-xs font-semibold hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
                  >
                    {isJa ? "過去30日の実績を表示" : "Show Last 30 Days"}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/firstFactory")}
                    className="px-3.5 py-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-xs font-semibold hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    {isJa ? "生産計画画面へ" : "Go to Scheduler"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[8px] border border-[var(--border)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-mono text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">{isJa ? "日付 / 時刻" : "Date / Time"}</th>
                      <th className="py-2.5 px-3">{isJa ? "品番 / ラベル" : "Part Number"}</th>
                      <th className="py-2.5 px-3">{isJa ? "品名・機材" : "Item / Material"}</th>
                      <th className="py-2.5 px-3">{isJa ? "設備 / 作業者" : "Machine / Worker"}</th>
                      <th className="py-2.5 px-3 text-right">{isJa ? "長さ / 本数" : "Length / Rolls"}</th>
                      <th className="py-2.5 px-3">{isJa ? "ロット / 材料QR" : "Lot / QR"}</th>
                      <th className="py-2.5 px-3">{isJa ? "ステータス" : "Status"}</th>
                      <th className="py-2.5 px-3 text-center">{isJa ? "特記事項" : "Details"}</th>
                      <th className="py-2.5 px-3 text-right">{isJa ? "操作" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredPsaRecords.map((r, i) => {
                      const totalRolls = r.totalRolls || (Array.isArray(r.items) ? r.items.length : 1);
                      let meters = Number(r.totalMeters) || Number(r.meters) || Number(r.rollMeters) || 0;
                      if (!meters && Array.isArray(r.items)) {
                        meters = r.items.reduce((acc, it) => acc + (Number(it.meters) || 0), 0);
                      }
                      const status = (r.status || "queue").toLowerCase();
                      const isCompleted = status === "completed";
                      const isInProgress = status === "in-progress" || status === "active";
                      const hasPhoto = Boolean(r.imageUrl || r.photoUrl || (r.items && r.items.some((it) => it.imageURL || it.imageUrl)));
                      const hasPrint = Array.isArray(r.printHistory) && r.printHistory.length > 0;
                      const isManual = Boolean(r.manualAdvance || (Array.isArray(r.printHistory) && r.printHistory.some((p) => p.manualAdvance)));

                      return (
                        <tr
                          key={r._id || r.itemId || i}
                          onClick={() => handleOpenPsaRoll(r)}
                          className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer group"
                        >
                          {/* Date / Time */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-mono font-bold text-[var(--text-primary)]">
                              {r.date || "—"}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono">
                              {r.actualStartTime || r.startTime || "—"}
                              {r.actualEndTime ? ` → ${r.actualEndTime}` : ""}
                              {r.actualDurationMins ? ` (${r.actualDurationMins}m)` : ""}
                            </div>
                          </td>

                          {/* Part Number */}
                          <td className="py-2.5 px-3">
                            <div className="font-mono font-bold text-[var(--text-primary)] text-xs">
                              {r.labelHinban || r.hinban || "—"}
                            </div>
                            {r.zuban ? (
                              <div className="text-[10px] text-[var(--text-muted)] font-mono">
                                図番: #{r.zuban}
                              </div>
                            ) : null}
                          </td>

                          {/* Item / Material */}
                          <td className="py-2.5 px-3 max-w-[200px] truncate">
                            <div className="font-medium text-[var(--text-primary)] truncate" title={r.hinmei}>
                              {r.hinmei || "—"}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)] font-mono truncate" title={r.kizai}>
                              {r.kizai || "—"} {r.color ? `(${r.color})` : ""}
                            </div>
                          </td>

                          {/* Machine / Worker */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-mono font-semibold text-[var(--text-primary)]">
                              {r.machine || "PSA2"}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>person</span>
                              {r.worker || "—"}
                            </div>
                          </td>

                          {/* Length / Rolls */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono">
                            <div className="font-bold text-[var(--text-primary)]">
                              {meters.toLocaleString()} m
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {r.rollIndex ? `Roll #${r.rollIndex}/${totalRolls}` : `${totalRolls} rolls`}
                            </div>
                          </td>

                          {/* Lot / QR */}
                          <td className="py-2.5 px-3 max-w-[160px] truncate font-mono text-[11px]">
                            {r.lotNo ? (
                              <span className="font-bold text-[var(--text-primary)] block truncate" title={r.lotNo}>
                                Lot: {r.lotNo}
                              </span>
                            ) : null}
                            {r.rawMaterialQR ? (
                              <span className="text-[10px] text-[var(--text-muted)] block truncate" title={r.rawMaterialQR}>
                                QR: {r.rawMaterialQR}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)]">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold border ${
                                isCompleted
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                                  : isInProgress
                                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25"
                                  : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isCompleted ? "bg-emerald-500" : isInProgress ? "bg-purple-500 animate-pulse" : "bg-slate-400"
                                }`}
                              />
                              {isCompleted ? (isJa ? "完了" : "Completed") : isInProgress ? (isJa ? "稼働中" : "In Progress") : (isJa ? "待機" : "Queue")}
                            </span>
                          </td>

                          {/* Details / Badges */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {hasPhoto && (
                                <span
                                  title={isJa ? "材料ラベル写真あり" : "Photo attached"}
                                  className="w-5 h-5 rounded-[4px] bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] border border-[var(--freya-blue)]/20 flex items-center justify-center"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>photo_camera</span>
                                </span>
                              )}
                              {hasPrint && (
                                <span
                                  title={isJa ? "印刷履歴あり" : "Print log available"}
                                  className="w-5 h-5 rounded-[4px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>print</span>
                                </span>
                              )}
                              {isManual && (
                                <span
                                  title={isJa ? "手動進行記録あり" : "Manual advance override"}
                                  className="w-5 h-5 rounded-[4px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>warning</span>
                                </span>
                              )}
                              {!hasPhoto && !hasPrint && !isManual && (
                                <span className="text-[var(--text-muted)]">—</span>
                              )}
                            </div>
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPsaRoll(r);
                              }}
                              className="px-2.5 py-1 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] group-hover:border-[var(--freya-blue)] text-[var(--text-primary)] group-hover:text-[var(--freya-blue)] text-xs font-semibold transition-colors shadow-2xs"
                            >
                              {isJa ? "詳細" : "View"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
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
        )}
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

      {/* ── First Factory PSA Roll Modal ── */}
      {selectedPsaRoll && (
        <FirstFactoryDetailModal
          roll={selectedPsaRoll}
          allRolls={selectedPsaRollsList}
          onClose={() => {
            setSelectedPsaRoll(null);
            setSelectedPsaRollsList([]);
          }}
          onSelectRoll={(r) => setSelectedPsaRoll(r)}
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

