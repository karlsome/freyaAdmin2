import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
import MasterTabNav from "../components/MasterTabNav";
import PageHeader from "../components/PageHeader";
import PlannerFilters from "../components/planner/PlannerFilters";
import PlannerGoalsPanel from "../components/planner/PlannerGoalsPanel";
import PlannerSelectedSummary from "../components/planner/PlannerSelectedSummary";
import PlannerTimelineView from "../components/planner/PlannerTimelineView";
import PlannerKanbanView from "../components/planner/PlannerKanbanView";
import PlannerTableView from "../components/planner/PlannerTableView";
import PlannerBreakModal from "../components/planner/PlannerBreakModal";
import PlannerManualGoalModal from "../components/planner/PlannerManualGoalModal";
import PlannerDuplicateChoiceModal from "../components/planner/PlannerDuplicateChoiceModal";
import PlannerGoalImportReviewModal from "../components/planner/PlannerGoalImportReviewModal";
import PlannerSlotSchedulingModal from "../components/planner/PlannerSlotSchedulingModal";
import PlannerSmartSchedulingModal from "../components/planner/PlannerSmartSchedulingModal";
import PlannerPrintModal from "../components/planner/PlannerPrintModal";
import PlannerBulkEditGoalsModal from "../components/planner/PlannerBulkEditGoalsModal";
import PlannerMachineStatusModal from "../components/planner/PlannerMachineStatusModal";
import PlannerPreviewTab from "../components/planner/PlannerPreviewTab";
import PlannerPublishedTab from "../components/planner/PlannerPublishedTab";
import {
  batchCreatePlannerGoals,
  checkPlannerGoalDuplicates,
  createPlannerGoal,
  deletePlannerGoal,
  deletePlannerPlanByFactoryDate,
  deletePlannerPreviewDraft,
  fetchPlannerActualProduction,
  fetchPlannerEquipment,
  fetchPlannerFactories,
  fetchPlannerGoals,
  fetchPlannerInProgress,
  fetchPlannerPlans,
  fetchPlannerPressHistory,
  fetchPlannerPreview,
  fetchPlannerProducts,
  fetchPlannerPublished,
  lookupPlannerProduct,
  publishPlannerSchedule,
  reconcilePlannerGoals,
  restorePlannerPublishedVersion,
  savePlannerPreviewDraft,
  schedulePlannerGoal,
  updatePlannerGoal,
  upsertPlannerPlan,
} from "../services/plannerApi";
import { getAuthUser } from "../utils/masterDB";
import {
  DEFAULT_BREAKS,
  PLANNER_CONFIG,
  buildProductColorMap,
  buildSmartAssignments,
  calculateProductionTime,
  cloneBreaks,
  createScheduledItem,
  getLatestEquipmentEnd,
  getProductCapacity,
  getScheduledSpan,
  getUserDisplayName,
  hasSchedulingConflict,
  isEquipmentUnavailable,
  isGroupEquipment,
  loadUnavailableEquipmentFromStorage,
  minutesToTime,
  normalizePlanProducts,
  processActualProductionData,
  processInProgressData,
  saveUnavailableEquipmentToStorage,
  timeToMinutes,
} from "../utils/planner";
import { openPlannerCalendarWindow, openPlannerPrintWindow } from "../utils/plannerExports";
import { useLanguage } from "../contexts/LanguageContext";

const MAIN_TABS = [
  { key: "goals", label: "Production Goals", labelJa: "生産目標", icon: "flag" },
  { key: "preview", label: "Preview", labelJa: "需要自動計画", icon: "radar" },
  { key: "published", label: "Published", labelJa: "公開スケジュール", icon: "broadcast_on_home" },
  { key: "planning", label: "Planning", labelJa: "計画立案", icon: "event_note" },
];

const VIEW_TABS = [
  { key: "timeline", label: "Timeline", labelJa: "タイムライン" },
  { key: "kanban", label: "Kanban", labelJa: "カンバン" },
  { key: "table", label: "Table", labelJa: "テーブル" },
];

const SMART_SCHEDULING_GRACE_MINUTES = 30;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function FlashBanner({ flash, onClose }) {
  if (!flash) return null;

  const tone = flash.type === "error"
    ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
    : flash.type === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : flash.type === "warning"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-[var(--freya-blue)]/20 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]";

  return (
    <div className={`mb-4 rounded-[6px] border px-4 py-3 text-xs ${tone}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="font-semibold">{flash.message}</span>
        </div>
        <button type="button" onClick={onClose} className="text-current/70 transition hover:text-current">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>
    </div>
  );
}

function readFileText(file, encoding = "Shift_JIS") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read CSV file."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file, encoding);
  });
}

function buildDuplicateKey(item) {
  return [item.date, item.背番号 || "", item.品番 || ""].join("__");
}

function serializePlanProducts(items = []) {
  return items.map((item) => ({
    _scheduleId: item._scheduleId,
    goalId: item.goalId,
    背番号: item.背番号,
    品番: item.品番,
    品名: item.品名,
    equipment: item.equipment,
    quantity: item.quantity,
    boxes: item.boxes,
    startTime: item.startTime,
    estimatedTime: item.estimatedTime,
  }));
}

function filterGoals(goals, searchValue) {
  const query = String(searchValue || "").trim().toLowerCase();
  if (!query) return goals;

  return goals.filter((goal) => (
    String(goal.背番号 || "").toLowerCase().includes(query)
    || String(goal.品番 || "").toLowerCase().includes(query)
    || String(goal.品名 || "").toLowerCase().includes(query)
  ));
}

export default function PlannerPage() {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const authUser = getAuthUser();
  const requestIdRef = useRef(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const mainTab = MAIN_TABS.some((t) => t.key === urlTab) ? urlTab : "goals";

  const [factories, setFactories] = useState([]);
  const [factoryName, setFactoryName] = useState(() => searchParams.get("factory") || localStorage.getItem("planner_selected_factory") || "");
  const [planDate, setPlanDate] = useState(() => searchParams.get("date") || todayStr());
  const [endDate, setEndDate] = useState(() => searchParams.get("endDate") || "");
  const [startTime, setStartTime] = useState(() => searchParams.get("startTime") || localStorage.getItem("planner_start_time") || "08:45");
  const [equipment, setEquipment] = useState([]);
  const [products, setProducts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [scheduledProducts, setScheduledProducts] = useState([]);
  const [actualBlocks, setActualBlocks] = useState([]);
  const [inProgressMap, setInProgressMap] = useState({});
  const [breaks, setBreaks] = useState(cloneBreaks(DEFAULT_BREAKS));
  const [currentPlanId, setCurrentPlanId] = useState("");
  const [loadingFactories, setLoadingFactories] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [viewTab, setViewTab] = useState("timeline");
  const [goalSearch, setGoalSearch] = useState("");
  const [selectedSearch, setSelectedSearch] = useState("");
  const [flash, setFlash] = useState(null);
  const [hideUnavailableEquipment, setHideUnavailableEquipment] = useState(false);
  const [unavailableEquipment, setUnavailableEquipment] = useState(() =>
    loadUnavailableEquipmentFromStorage(searchParams.get("factory") || localStorage.getItem("planner_selected_factory") || "")
  );
  const [machineStatusModalOpen, setMachineStatusModalOpen] = useState(false);
  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [breakSaving, setBreakSaving] = useState(false);
  const [manualGoalOpen, setManualGoalOpen] = useState(false);
  const [manualGoalSubmitting, setManualGoalSubmitting] = useState(false);
  const [duplicateState, setDuplicateState] = useState({ open: false, existingGoal: null, pendingGoal: null });
  const [duplicateBusy, setDuplicateBusy] = useState(false);
  const [csvReading, setCsvReading] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvReviewRows, setCsvReviewRows] = useState([]);
  const [slotModalState, setSlotModalState] = useState({ open: false, equipment: "", startTime: "" });
  const [slotSubmitting, setSlotSubmitting] = useState(false);
  const [smartPreviewLoading, setSmartPreviewLoading] = useState(false);
  const [smartApplying, setSmartApplying] = useState(false);
  const [smartPreview, setSmartPreview] = useState(null);
  const [smartPreviewOpen, setSmartPreviewOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Bulk Edit Goals
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditBusy, setBulkEditBusy] = useState(false);

  // Timeline Reconciliation
  const [reconciling, setReconciling] = useState(false);

  // Auto-planner Preview & Draft
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSaving, setPreviewSaving] = useState(false);
  const [previewPublishing, setPreviewPublishing] = useState(false);

  // Published Schedule
  const [publishedData, setPublishedData] = useState(null);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [publishedRestoring, setPublishedRestoring] = useState(false);

  function handleMainTabChange(nextTab) {
    const t0 = performance.now();
    console.log(`⏱️ [Planner] Tab button clicked: current="${mainTab}" -> target="${nextTab}" at ${t0.toFixed(1)}ms`);
    console.time(`⏱️ [Planner] Total tab transition to "${nextTab}"`);
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === "goals") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }
    setSearchParams(nextParams, { replace: true });
    console.log(`⏱️ [Planner] setSearchParams completed in ${(performance.now() - t0).toFixed(1)}ms`);
  }

  useEffect(() => {
    console.log(`🎯 [Planner] Active tab rendered: "${mainTab}"`);
    try {
      console.timeEnd(`⏱️ [Planner] Total tab transition to "${mainTab}"`);
    } catch {}
  }, [mainTab]);

  const productColors = buildProductColorMap(products, [...goals, ...scheduledProducts]);
  const filteredGoals = filterGoals(goals, goalSearch);
  const outOfSyncCount = useMemo(() => {
    return goals.reduce((count, goal) => {
      if (goal.date !== planDate) return count;
      const actual = scheduledProducts
        .filter((p) => (p.goalId && p.goalId === goal._id) || (p.背番号 && p.背番号 === goal.背番号))
        .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
      return actual !== Number(goal.scheduledQuantity || 0) ? count + 1 : count;
    }, 0);
  }, [goals, planDate, scheduledProducts]);

  function showFlash(message, type = "info") {
    setFlash({ message, type });
  }

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(null), 4500);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    let cancelled = false;

    async function loadFactories() {
      setLoadingFactories(true);
      try {
        const nextFactories = await fetchPlannerFactories();
        if (cancelled) return;
        setFactories(nextFactories);

        if (factoryName && !nextFactories.includes(factoryName)) {
          setFactoryName("");
          localStorage.removeItem("planner_selected_factory");
        }
      } catch (error) {
        if (cancelled) return;
        showFlash(error.message || "Failed to load factories.", "error");
      } finally {
        if (!cancelled) setLoadingFactories(false);
      }
    }

    loadFactories();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPlannerData = useCallback(async (overrides = {}) => {
    const nextFactory = overrides.factoryName ?? factoryName;
    const nextDate = overrides.planDate ?? planDate;
    const nextEndDate = overrides.endDate ?? endDate;
    const activeRangeEnd = nextEndDate && nextEndDate >= nextDate ? nextEndDate : "";

    if (!nextFactory) {
      console.log("ℹ️ [Planner API] No factory selected, resetting planner state.");
      setEquipment([]);
      setGoals([]);
      setScheduledProducts([]);
      setActualBlocks([]);
      setInProgressMap({});
      setBreaks(cloneBreaks(DEFAULT_BREAKS));
      setUnavailableEquipment([]);
      setCurrentPlanId("");
      return;
    }

    const requestId = ++requestIdRef.current;
    console.log(`🔄 [Planner API #${requestId}] Loading data for factory="${nextFactory}", date="${nextDate}"`);
    console.time(`⏱️ [Planner API #${requestId}] Total data fetch`);
    setDataLoading(true);

    try {
      const [nextEquipment, nextProducts, nextGoals, nextPlans, actualRows, inProgressRows] = await Promise.all([
        fetchPlannerEquipment(nextFactory),
        fetchPlannerProducts(),
        fetchPlannerGoals({ factory: nextFactory, date: nextDate, endDate: activeRangeEnd }),
        fetchPlannerPlans({ factory: nextFactory, date: nextDate }),
        fetchPlannerActualProduction(nextFactory, nextDate),
        fetchPlannerInProgress(nextFactory, nextDate),
      ]);

      if (requestId !== requestIdRef.current) {
        console.warn(`⚠️ [Planner API #${requestId}] Stale response ignored (current is #${requestIdRef.current})`);
        return;
      }

      console.timeEnd(`⏱️ [Planner API #${requestId}] Total data fetch`);
      console.log(`✅ [Planner API #${requestId}] Received:`, {
        equipment: nextEquipment.length,
        products: nextProducts.length,
        goals: nextGoals.length,
        plans: nextPlans.length,
        actualRows: actualRows.length,
        inProgressRows: inProgressRows.length,
      });

      const nextColorMap = buildProductColorMap(nextProducts, nextGoals);
      const currentPlan = Array.isArray(nextPlans) && nextPlans.length ? nextPlans[0] : null;

      setEquipment(nextEquipment);
      setProducts(nextProducts);
      setGoals(nextGoals);
      setScheduledProducts(normalizePlanProducts(currentPlan?.products || [], nextProducts, nextColorMap));
      setActualBlocks(processActualProductionData(actualRows));
      setInProgressMap(processInProgressData(inProgressRows));
      setBreaks(currentPlan?.breaks?.length ? cloneBreaks(currentPlan.breaks) : cloneBreaks(DEFAULT_BREAKS));
      if (currentPlan?.startTime) {
        setStartTime(currentPlan.startTime);
        localStorage.setItem("planner_start_time", currentPlan.startTime);
      }
      const planUnavailable = Array.isArray(currentPlan?.unavailableEquipment) ? currentPlan.unavailableEquipment : null;
      const storedUnavailable = loadUnavailableEquipmentFromStorage(nextFactory);
      const activeUnavailable = planUnavailable !== null ? planUnavailable : storedUnavailable;
      setUnavailableEquipment(activeUnavailable);
      saveUnavailableEquipmentToStorage(nextFactory, activeUnavailable);
      setCurrentPlanId(currentPlan?._id || "");
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error(`❌ [Planner API #${requestId}] Error loading planner data:`, error);
      showFlash(error.message || "Failed to load planner data.", "error");
    } finally {
      if (requestId === requestIdRef.current) {
        setDataLoading(false);
      }
    }
  }, [factoryName, planDate, endDate]);

  useEffect(() => {
    loadPlannerData();
  }, [loadPlannerData]);

  async function persistPlan(nextProducts, nextBreaks, nextStartTime = startTime, nextUnavailable = unavailableEquipment) {
    if (!factoryName) return;

    if (!nextProducts.length && !nextUnavailable?.length) {
      await deletePlannerPlanByFactoryDate(factoryName, planDate);
      setCurrentPlanId("");
      return;
    }

    await upsertPlannerPlan({
      factory: factoryName,
      date: planDate,
      products: serializePlanProducts(nextProducts),
      breaks: cloneBreaks(nextBreaks),
      startTime: nextStartTime,
      unavailableEquipment: nextUnavailable,
      createdBy: getUserDisplayName(authUser),
    });
  }

  async function handleUpdateMachineStatus(targetEquipment, isUnavailable, reason = "") {
    if (!factoryName || !targetEquipment) return;

    const currentList = Array.isArray(unavailableEquipment) ? [...unavailableEquipment] : [];
    let nextList;
    if (isUnavailable) {
      const existingIdx = currentList.findIndex((item) => {
        const name = typeof item === "string" ? item : item?.equipment;
        return name === targetEquipment;
      });
      const newEntry = {
        equipment: targetEquipment,
        reason: reason || (isJa ? "故障・メンテナンス中" : "Maintenance / Out of service"),
        reportedAt: new Date().toISOString(),
        reportedBy: getUserDisplayName(authUser),
      };
      if (existingIdx >= 0) {
        nextList = [...currentList];
        nextList[existingIdx] = newEntry;
      } else {
        nextList = [...currentList, newEntry];
      }
    } else {
      nextList = currentList.filter((item) => {
        const name = typeof item === "string" ? item : item?.equipment;
        return name !== targetEquipment;
      });
    }

    setUnavailableEquipment(nextList);
    saveUnavailableEquipmentToStorage(factoryName, nextList);

    try {
      await persistPlan(scheduledProducts, breaks, startTime, nextList);
      showFlash(
        isUnavailable
          ? (isJa ? `設備「${targetEquipment}」を停止中に設定しました。` : `Machine ${targetEquipment} marked as unavailable.`)
          : (isJa ? `設備「${targetEquipment}」の停止を解除しました。` : `Machine ${targetEquipment} marked as operational.`),
        "success"
      );
    } catch (err) {
      console.error("Failed to persist unavailable equipment:", err);
      showFlash(err.message || (isJa ? "設備状況の保存に失敗しました。" : "Failed to save machine status."), "error");
    }
  }

  function handleStartTimeChange(nextStartTime) {
    const value = nextStartTime || "08:45";
    setStartTime(value);
    localStorage.setItem("planner_start_time", value);
    const nextParams = new URLSearchParams(searchParams);
    if (value && value !== "08:45") nextParams.set("startTime", value);
    else nextParams.delete("startTime");
    setSearchParams(nextParams, { replace: true });
    if (scheduledProducts.length > 0) {
      persistPlan(scheduledProducts, breaks, value);
    }
  }

  async function refreshAfterMutation(message, type = "success") {
    await loadPlannerData();
    if (message) showFlash(message, type);
  }

  // ─── Auto-Planner Preview Loaders & Handlers ────────────────────────────────
  const loadPreview = useCallback(async (forceRefresh = false) => {
    if (!factoryName || !planDate) return;
    setPreviewLoading(true);
    try {
      const data = await fetchPlannerPreview({ factory: factoryName, date: planDate, forceRefresh });
      setPreviewData(data);
    } catch (err) {
      showFlash(err.message || (isJa ? "プレビューデータの取得に失敗しました。" : "Failed to load preview data."), "error");
    } finally {
      setPreviewLoading(false);
    }
  }, [factoryName, planDate, isJa]);

  useEffect(() => {
    if (mainTab === "preview" && factoryName && planDate) {
      loadPreview();
    }
  }, [mainTab, factoryName, planDate, loadPreview]);

  async function handleSavePreviewDraft({ scheduleUntilTime, assignments, basisRows }) {
    if (!factoryName || !planDate) return;
    setPreviewSaving(true);
    try {
      await savePlannerPreviewDraft({
        factory: factoryName,
        date: planDate,
        scheduleUntilTime,
        updatedBy: getUserDisplayName(authUser),
        assignments,
        basisRows,
      });
      await loadPreview(true);
      showFlash(isJa ? "需要計画下書きを保存しました。" : "Preview draft saved successfully.", "success");
    } catch (err) {
      showFlash(err.message || (isJa ? "下書きの保存に失敗しました。" : "Failed to save draft."), "error");
    } finally {
      setPreviewSaving(false);
    }
  }

  async function handleDiscardPreviewDraft() {
    if (!factoryName || !planDate) return;
    setPreviewSaving(true);
    try {
      await deletePlannerPreviewDraft({ factory: factoryName, date: planDate });
      await loadPreview(true);
      showFlash(isJa ? "需要計画下書きを破棄しました。" : "Draft discarded.", "info");
    } catch (err) {
      showFlash(err.message || (isJa ? "下書きの破棄に失敗しました。" : "Failed to discard draft."), "error");
    } finally {
      setPreviewSaving(false);
    }
  }

  async function handlePublishFromPreview({
    scheduleUntilTime,
    sourceMode,
    sourceType,
    sourceLabel,
    note,
    assignments,
    basisRows,
  }) {
    if (!factoryName || !planDate) return;
    setPreviewPublishing(true);
    try {
      await publishPlannerSchedule({
        factory: factoryName,
        date: planDate,
        scheduleUntilTime,
        sourceMode,
        sourceType,
        sourceLabel,
        note,
        publishedBy: getUserDisplayName(authUser),
        assignments,
        basisRows,
      });
      showFlash(isJa ? "スケジュールを公開しました。" : "Schedule published to shop floor successfully.", "success");
      handleMainTabChange("published");
    } catch (err) {
      showFlash(err.message || (isJa ? "スケジュールの公開に失敗しました。" : "Failed to publish schedule."), "error");
    } finally {
      setPreviewPublishing(false);
    }
  }

  // ─── Published Schedule Loaders & Handlers ──────────────────────────────────
  const loadPublished = useCallback(async (forceRefresh = false) => {
    if (!factoryName || !planDate) return;
    setPublishedLoading(true);
    try {
      const data = await fetchPlannerPublished({ factory: factoryName, date: planDate, forceRefresh });
      setPublishedData(data);
    } catch (err) {
      showFlash(err.message || (isJa ? "公開スケジュールの取得に失敗しました。" : "Failed to load published schedule."), "error");
    } finally {
      setPublishedLoading(false);
    }
  }, [factoryName, planDate, isJa]);

  useEffect(() => {
    if (mainTab === "published" && factoryName && planDate) {
      loadPublished();
    }
  }, [mainTab, factoryName, planDate, loadPublished]);

  async function handleRestorePublishedVersion(versionNumber) {
    if (!factoryName || !planDate || !versionNumber) return;
    setPublishedRestoring(true);
    try {
      await restorePlannerPublishedVersion({
        factory: factoryName,
        date: planDate,
        sourceVersion: versionNumber,
        publishedBy: getUserDisplayName(authUser),
        note: `Restored version v${versionNumber}`,
      });
      await loadPublished(true);
      showFlash(isJa ? `バージョン v${versionNumber} を復元しました。` : `Restored version v${versionNumber}.`, "success");
    } catch (err) {
      showFlash(err.message || (isJa ? "バージョンの復元に失敗しました。" : "Failed to restore version."), "error");
    } finally {
      setPublishedRestoring(false);
    }
  }

  // ─── Bulk Edit Goals Handlers ───────────────────────────────────────────────
  async function handleBulkDeleteSelected(ids) {
    if (!ids?.length) return;
    setBulkEditBusy(true);
    try {
      await Promise.all(ids.map((id) => deletePlannerGoal(id)));
      await refreshAfterMutation(
        isJa ? `${ids.length} 件の目標を削除しました。` : `Deleted ${ids.length} goal(s).`
      );
    } catch (err) {
      showFlash(err.message || (isJa ? "目標の削除に失敗しました。" : "Failed to delete goals."), "error");
    } finally {
      setBulkEditBusy(false);
    }
  }

  async function handleBulkDeleteAll(ids) {
    if (!ids?.length) return;
    setBulkEditBusy(true);
    try {
      await Promise.all(ids.map((id) => deletePlannerGoal(id)));
      await refreshAfterMutation(
        isJa ? `本日の目標 ${ids.length} 件をすべて削除しました。` : `Deleted all ${ids.length} goal(s).`
      );
    } catch (err) {
      showFlash(err.message || (isJa ? "すべての目標の削除に失敗しました。" : "Failed to delete all goals."), "error");
    } finally {
      setBulkEditBusy(false);
    }
  }

  async function handleBulkUpdateTarget(goalId, newTarget) {
    const targetGoal = goals.find((g) => g._id === goalId);
    const scheduled = Number(targetGoal?.scheduledQuantity) || 0;
    const remaining = Math.max(0, newTarget - scheduled);
    const status = scheduled >= newTarget ? "completed" : scheduled > 0 ? "in-progress" : "pending";

    await updatePlannerGoal(goalId, {
      targetQuantity: newTarget,
      remainingQuantity: remaining,
      status,
    });
    await refreshAfterMutation(
      isJa ? "目標数量を更新しました。" : "Goal quantity updated."
    );
  }

  // ─── Timeline Reconciliation Handlers ───────────────────────────────────────
  async function handleReconcileGoals() {
    if (!factoryName) return;
    setReconciling(true);
    try {
      const result = await reconcilePlannerGoals({
        factory: factoryName,
        date: planDate,
        goals,
        scheduledProducts,
      });
      if (result.updatedCount > 0) {
        await refreshAfterMutation(
          isJa
            ? `${result.updatedCount} 件の目標をタイムラインと同期しました。`
            : `Reconciled ${result.updatedCount} goal(s) with timeline.`
        );
      } else {
        showFlash(isJa ? "すべての目標はタイムラインと同期されています。" : "All goals are already in sync with the timeline.", "info");
      }
    } catch (err) {
      showFlash(err.message || (isJa ? "同期に失敗しました。" : "Failed to reconcile goals."), "error");
    } finally {
      setReconciling(false);
    }
  }

  async function handleReconcileSingleGoal(goal) {
    if (!goal?._id) return;
    const actual = scheduledProducts
      .filter((p) => (p.goalId && p.goalId === goal._id) || (p.背番号 && p.背番号 === goal.背番号))
      .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
    const target = Number(goal.targetQuantity) || 0;
    const newRemaining = Math.max(0, target - actual);
    const newStatus = actual >= target ? "completed" : actual > 0 ? "in-progress" : "pending";

    try {
      await updatePlannerGoal(goal._id, {
        scheduledQuantity: actual,
        remainingQuantity: newRemaining,
        status: newStatus,
      });
      await refreshAfterMutation(
        isJa ? `目標 (${goal.背番号 || goal.品番}) をタイムラインと同期しました。` : `Goal (${goal.背番号 || goal.品番}) reconciled with timeline.`
      );
    } catch (err) {
      showFlash(err.message || (isJa ? "同期に失敗しました。" : "Failed to reconcile goal."), "error");
    }
  }

  async function handleManualGoalSubmit({ product, quantity, date }) {
    if (!factoryName) {
      showFlash("Select a factory before creating goals.", "warning");
      return;
    }

    setManualGoalSubmitting(true);

    const pendingGoal = {
      factory: factoryName,
      date,
      背番号: product.背番号,
      品番: product.品番,
      品名: product.品名,
      targetQuantity: quantity,
      createdBy: getUserDisplayName(authUser),
    };

    try {
      const duplicateResult = await checkPlannerGoalDuplicates(factoryName, [
        { 背番号: pendingGoal.背番号, 品番: pendingGoal.品番, date: pendingGoal.date },
      ]);

      if (duplicateResult?.hasDuplicates && duplicateResult.duplicates?.length) {
        setDuplicateState({ open: true, existingGoal: duplicateResult.duplicates[0], pendingGoal });
        return;
      }

      await createPlannerGoal(pendingGoal);
      setManualGoalOpen(false);
      await refreshAfterMutation("Goal added successfully.");
    } catch (error) {
      showFlash(error.message || "Failed to create goal.", "error");
    } finally {
      setManualGoalSubmitting(false);
    }
  }

  async function handleDuplicateResolution(action) {
    const { existingGoal, pendingGoal } = duplicateState;

    if (action === "cancel" || !existingGoal || !pendingGoal) {
      setDuplicateState({ open: false, existingGoal: null, pendingGoal: null });
      return;
    }

    setDuplicateBusy(true);
    try {
      const nextTargetQuantity = action === "add"
        ? Number(existingGoal.targetQuantity || 0) + Number(pendingGoal.targetQuantity || 0)
        : Number(pendingGoal.targetQuantity || 0);

      await updatePlannerGoal(existingGoal._id, { targetQuantity: nextTargetQuantity });
      setDuplicateState({ open: false, existingGoal: null, pendingGoal: null });
      setManualGoalOpen(false);
      await refreshAfterMutation(`Goal ${action === "add" ? "updated" : "overwritten"} successfully.`);
    } catch (error) {
      showFlash(error.message || "Failed to resolve duplicate goal.", "error");
    } finally {
      setDuplicateBusy(false);
      setManualGoalSubmitting(false);
    }
  }

  async function handleCsvSelected(file) {
    if (!file) return;

    if (!factoryName) {
      showFlash("Select a factory before importing goals.", "warning");
      return;
    }

    setCsvReading(true);

    try {
      const csvText = await readFileText(file, "Shift_JIS");
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (value) => String(value || "").trim(),
      });

      const firstRow = parsed.data?.[0] || {};
      const headers = Object.keys(firstRow);
      const searchType = headers.includes("背番号") ? "背番号" : headers.includes("品番") ? "品番" : "";

      if (!searchType || !headers.includes("収容数") || !headers.includes("日付")) {
        throw new Error("Invalid CSV format. Expected headers: 背番号,収容数,日付 or 品番,収容数,日付.");
      }

      const baseRows = parsed.data.map((row, index) => {
        const searchValue = String(row[searchType] || "").trim();
        const targetQuantity = Number(String(row["収容数"] || "").replace(/,/g, "").trim());
        const date = String(row["日付"] || "").trim();

        if (!searchValue || !date || !(targetQuantity > 0)) {
          return {
            id: `csv-${index}`,
            status: "error",
            date,
            targetQuantity: targetQuantity || 0,
            error: "Missing or invalid row data",
          };
        }

        return {
          id: `csv-${index}`,
          status: "pending",
          date,
          targetQuantity,
          searchType,
          searchValue,
        };
      });

      const resolvedRows = await Promise.all(baseRows.map(async (row) => {
        if (row.status === "error") return row;

        try {
          const result = await lookupPlannerProduct({ searchType: row.searchType, searchValue: row.searchValue, factory: factoryName });
          if (!result?.success) {
            return { ...row, status: "error", error: result?.error || "Product not found" };
          }

          return {
            ...row,
            status: "valid",
            ...result.data,
          };
        } catch (error) {
          return { ...row, status: "error", error: error.message || "Lookup failed" };
        }
      }));

      const duplicateCandidates = resolvedRows
        .filter((row) => row.status === "valid")
        .map((row) => ({ 背番号: row.背番号, 品番: row.品番, date: row.date }));

      const duplicateResult = duplicateCandidates.length
        ? await checkPlannerGoalDuplicates(factoryName, duplicateCandidates)
        : { duplicates: [] };

      const duplicateMap = new Map((duplicateResult?.duplicates || []).map((item) => [buildDuplicateKey(item), item]));
      const reviewRows = resolvedRows.map((row) => {
        if (row.status !== "valid") return row;
        const existingGoal = duplicateMap.get(buildDuplicateKey(row));
        if (!existingGoal) return row;
        return { ...row, status: "duplicate", existingGoal };
      });

      setCsvReviewRows(reviewRows);
    } catch (error) {
      showFlash(error.message || "Failed to parse CSV.", "error");
    } finally {
      setCsvReading(false);
    }
  }

  async function handleConfirmCsvImport(decisions) {
    setCsvImporting(true);

    try {
      const updates = [];
      const newGoals = [];

      csvReviewRows.forEach((row) => {
        if (row.status === "error") return;

        if (row.status === "duplicate") {
          const action = decisions[row.id] || "add";
          if (action === "skip") return;

          const targetQuantity = action === "overwrite"
            ? Number(row.targetQuantity)
            : Number(row.existingGoal?.targetQuantity || 0) + Number(row.targetQuantity || 0);

          updates.push(updatePlannerGoal(row.existingGoal._id, { targetQuantity }));
          return;
        }

        newGoals.push({
          factory: factoryName,
          date: row.date,
          背番号: row.背番号,
          品番: row.品番,
          品名: row.品名,
          targetQuantity: row.targetQuantity,
        });
      });

      await Promise.all(updates);
      if (newGoals.length) {
        await batchCreatePlannerGoals(newGoals, getUserDisplayName(authUser));
      }

      setCsvReviewRows([]);
      await refreshAfterMutation(`Imported ${newGoals.length + updates.length} goal change${newGoals.length + updates.length === 1 ? "" : "s"}.`);
    } catch (error) {
      showFlash(error.message || "Failed to import goals.", "error");
    } finally {
      setCsvImporting(false);
    }
  }

  async function handleDeleteGoal(goal) {
    const scheduledCount = scheduledProducts.filter((item) => item.goalId === goal._id).length;
    const confirmed = window.confirm(
      scheduledCount
        ? `Delete ${goal.背番号 || goal.品番}? This will also remove ${scheduledCount} scheduled item(s) from the plan.`
        : `Delete ${goal.背番号 || goal.品番}?`,
    );

    if (!confirmed) return;

    try {
      if (scheduledCount) {
        const nextProducts = scheduledProducts.filter((item) => item.goalId !== goal._id);
        await persistPlan(nextProducts, breaks);
      }

      await deletePlannerGoal(goal._id);
      await refreshAfterMutation("Goal deleted.");
    } catch (error) {
      showFlash(error.message || "Failed to delete goal.", "error");
    }
  }

  async function handleSaveBreaks(nextBreaks) {
    setBreakSaving(true);

    try {
      setBreaks(nextBreaks);
      await persistPlan(scheduledProducts, nextBreaks);
      setBreakModalOpen(false);
      await refreshAfterMutation("Break schedule updated.");
    } catch (error) {
      showFlash(error.message || "Failed to save breaks.", "error");
      setBreaks(cloneBreaks(breaks));
    } finally {
      setBreakSaving(false);
    }
  }

  async function handleSlotSchedule(queue) {
    setSlotSubmitting(true);

    try {
      const nextProducts = [...scheduledProducts];
      const scheduleOperations = [];
      let nextStartMinutes = timeToMinutes(slotModalState.startTime);

      for (const queueItem of queue) {
        const liveGoal = goals.find((goal) => goal._id === queueItem._id);
        if (!liveGoal) {
          throw new Error(`Goal ${queueItem.背番号 || queueItem.品番} is no longer available.`);
        }

        if (Number(queueItem.quantity || 0) > Number(liveGoal.remainingQuantity || 0)) {
          throw new Error(`${queueItem.背番号 || queueItem.品番} exceeds remaining quantity.`);
        }

        const scheduledItem = createScheduledItem({
          goal: liveGoal,
          equipment: slotModalState.equipment,
          quantity: Number(queueItem.quantity || 0),
          startMinutes: nextStartMinutes,
          products,
          productColors,
          breaks,
        });

        const conflict = hasSchedulingConflict(scheduledItem, nextProducts, breaks);
        if (conflict.hasConflict) {
          throw new Error(`${scheduledItem.背番号} conflicts with ${conflict.conflictingItem?.背番号} at ${conflict.conflictingRange}.`);
        }

        nextProducts.push(scheduledItem);
        nextStartMinutes = getScheduledSpan(scheduledItem, breaks).endTime;
        scheduleOperations.push(schedulePlannerGoal(liveGoal._id, scheduledItem.quantity));
      }

      if (!scheduleOperations.length) {
        throw new Error("No goals selected for scheduling.");
      }

      await Promise.all(scheduleOperations);
      await persistPlan(nextProducts, breaks);
      setSlotModalState({ open: false, equipment: "", startTime: "" });
      handleMainTabChange("planning");
      await refreshAfterMutation(`Scheduled ${queue.length} goal${queue.length === 1 ? "" : "s"}.`);
    } catch (error) {
      showFlash(error.message || "Failed to schedule goals.", "error");
    } finally {
      setSlotSubmitting(false);
    }
  }

  async function handleRemoveScheduledItem(item) {
    const nextProducts = scheduledProducts.filter((entry) => entry._scheduleId !== item._scheduleId);

    try {
      const goal = goals.find((entry) => entry._id === item.goalId);
      if (goal) {
        await updatePlannerGoal(goal._id, {
          remainingQuantity: Number(goal.remainingQuantity || 0) + Number(item.quantity || 0),
          scheduledQuantity: Math.max(0, Number(goal.scheduledQuantity || 0) - Number(item.quantity || 0)),
        });
      }

      await persistPlan(nextProducts, breaks);
      await refreshAfterMutation(`${item.背番号 || item.品番} removed from the plan.`);
    } catch (error) {
      showFlash(error.message || "Failed to remove scheduled product.", "error");
    }
  }

  async function handleClearAllScheduled() {
    if (!scheduledProducts.length) return;

    const confirmed = window.confirm(`Clear all ${scheduledProducts.length} scheduled product(s) from the current plan?`);
    if (!confirmed) return;

    try {
      const quantitiesByGoal = scheduledProducts.reduce((totals, item) => {
        if (!item.goalId) return totals;
        totals[item.goalId] = (totals[item.goalId] || 0) + Number(item.quantity || 0);
        return totals;
      }, {});

      await Promise.all(Object.entries(quantitiesByGoal).map(([goalId, quantity]) => {
        const goal = goals.find((entry) => entry._id === goalId);
        if (!goal) return Promise.resolve();

        return updatePlannerGoal(goalId, {
          remainingQuantity: Number(goal.remainingQuantity || 0) + Number(quantity || 0),
          scheduledQuantity: Math.max(0, Number(goal.scheduledQuantity || 0) - Number(quantity || 0)),
        });
      }));

      await persistPlan([], breaks);
      await refreshAfterMutation("Cleared all scheduled products.");
    } catch (error) {
      showFlash(error.message || "Failed to clear scheduled products.", "error");
    }
  }

  async function handleMoveScheduledItem(scheduleId, equipmentName, startTime) {
    const item = scheduledProducts.find((entry) => entry._scheduleId === scheduleId);
    if (!item) return;

    const nextItem = { ...item, equipment: equipmentName, startTime };
    const otherItems = scheduledProducts.filter((entry) => entry._scheduleId !== scheduleId);
    const conflict = hasSchedulingConflict(nextItem, otherItems, breaks);

    if (conflict.hasConflict) {
      showFlash(`Cannot move ${item.背番号 || item.品番}; it overlaps with ${conflict.conflictingItem?.背番号}.`, "warning");
      return;
    }

    try {
      await persistPlan([...otherItems, nextItem], breaks);
      await refreshAfterMutation(`${item.背番号 || item.品番} moved to ${equipmentName} ${startTime}.`);
    } catch (error) {
      showFlash(error.message || "Failed to reschedule product.", "error");
    }
  }

  async function handleMoveKanbanItem(scheduleId, equipmentName) {
    const item = scheduledProducts.find((entry) => entry._scheduleId === scheduleId);
    if (!item || item.equipment === equipmentName) return;

    const otherItems = scheduledProducts.filter((entry) => entry._scheduleId !== scheduleId);
    const nextStartMinutes = getLatestEquipmentEnd(otherItems, equipmentName, breaks);
    const nextItem = {
      ...item,
      equipment: equipmentName,
      startTime: minutesToTime(nextStartMinutes),
    };

    const conflict = hasSchedulingConflict(nextItem, otherItems, breaks);
    if (conflict.hasConflict) {
      showFlash(`Cannot move ${item.背番号 || item.品番}; it overlaps with ${conflict.conflictingItem?.背番号}.`, "warning");
      return;
    }

    try {
      await persistPlan([...otherItems, nextItem], breaks);
      await refreshAfterMutation(`${item.背番号 || item.品番} moved to ${equipmentName}.`);
    } catch (error) {
      showFlash(error.message || "Failed to move product.", "error");
    }
  }

  function handleGoalPlanIntent(goal) {
    if (goal.date !== planDate) {
      setPlanDate(goal.date);
      setEndDate("");
    }
    handleMainTabChange("planning");
    showFlash(`Switch to the timeline and click a slot to place ${goal.背番号 || goal.品番}.`, "info");
  }

  async function handleOpenSmartScheduling() {
    if (!factoryName) {
      showFlash("Select a factory before running smart scheduling.", "warning");
      return;
    }

    const schedulableGoals = goals.filter((goal) => goal.date === planDate && Number(goal.remainingQuantity || 0) > 0);
    if (!schedulableGoals.length) {
      showFlash("No goals with remaining quantity are available for the selected date.", "warning");
      return;
    }

    setSmartPreviewLoading(true);
    try {
      const result = await fetchPlannerPressHistory(factoryName, schedulableGoals.map((goal) => ({ 背番号: goal.背番号, 品番: goal.品番 })));
      const preview = buildSmartAssignments(goals, planDate, result?.trends || {}, products, unavailableEquipment);
      setSmartPreview({ ...preview, trends: result?.trends || {} });
      setSmartPreviewOpen(true);
    } catch (error) {
      showFlash(error.message || "Failed to analyze press history.", "error");
    } finally {
      setSmartPreviewLoading(false);
    }
  }

  async function handleApplySmartScheduling(timeLimit) {
    if (!smartPreview) return;

    setSmartApplying(true);

    try {
      const latestPlans = await fetchPlannerPlans({ factory: factoryName, date: planDate });
      const baseScheduledProducts = normalizePlanProducts(latestPlans[0]?.products || [], products, productColors);
      const workingProducts = [...baseScheduledProducts];
      const scheduleOperations = [];
      const unavailableParts = new Set();
      const maxEndTime = timeToMinutes(timeLimit);

      workingProducts.forEach((item) => {
        if (!isGroupEquipment(item.equipment)) return;
        item.equipment.split(",").map((part) => part.trim()).forEach((part) => unavailableParts.add(part));
      });

      let scheduledCount = 0;
      let skippedCount = 0;

      for (const productsForEquipment of Object.values(smartPreview.assignments || {})) {
        for (const goal of productsForEquipment) {
          const trend = smartPreview.trends?.[goal.背番号 || goal.品番];
          if (!trend?.equipmentDistribution) {
            skippedCount += 1;
            continue;
          }

          const remainingQuantity = Number(goal.remainingQuantity || 0);
          const capacity = getProductCapacity(goal, products);
          const rankedEquipment = Object.entries(trend.equipmentDistribution)
            .sort((left, right) => right[1] - left[1])
            .map(([equipmentName, frequency]) => ({ equipmentName, frequency }));

          let scheduled = false;

          for (const { equipmentName } of rankedEquipment) {
            if (isEquipmentUnavailable(equipmentName, unavailableEquipment)) continue;
            if (!isGroupEquipment(equipmentName) && unavailableParts.has(equipmentName)) continue;

            if (isGroupEquipment(equipmentName)) {
              const parts = equipmentName.split(",").map((part) => part.trim());
              const hasPartConflict = parts.some((part) => workingProducts.some((item) => item.equipment === part));
              if (hasPartConflict) continue;
            }

            const currentStartMinutes = getLatestEquipmentEnd(workingProducts, equipmentName, breaks, startTime);
            const availableWindow = (maxEndTime + SMART_SCHEDULING_GRACE_MINUTES) - currentStartMinutes;
            if (availableWindow <= 0) continue;

            const totalBoxesNeeded = Math.ceil(remainingQuantity / capacity);
            let scanTime = currentStartMinutes;
            let boxesThatFit = 0;

            for (let boxIndex = 1; boxIndex <= totalBoxesNeeded; boxIndex += 1) {
              const boxQuantity = Math.min(capacity, remainingQuantity - ((boxIndex - 1) * capacity));
              const boxTiming = calculateProductionTime(goal, boxQuantity);
              const nextWindow = getScheduledSpan({
                equipment: equipmentName,
                startTime: minutesToTime(scanTime),
                estimatedTime: boxTiming,
              }, breaks);

              if (nextWindow.endTime <= (maxEndTime + SMART_SCHEDULING_GRACE_MINUTES)) {
                boxesThatFit = boxIndex;
                scanTime = nextWindow.endTime;
              } else {
                break;
              }
            }

            if (!boxesThatFit) continue;

            const quantityToSchedule = Math.min(remainingQuantity, boxesThatFit * capacity);
            const scheduledItem = createScheduledItem({
              goal,
              equipment: equipmentName,
              quantity: quantityToSchedule,
              startMinutes: currentStartMinutes,
              products,
              productColors,
              breaks,
            });

            const conflict = hasSchedulingConflict(scheduledItem, workingProducts, breaks);
            if (conflict.hasConflict) continue;

            workingProducts.push(scheduledItem);
            scheduleOperations.push(schedulePlannerGoal(goal._id, quantityToSchedule));
            if (isGroupEquipment(equipmentName)) {
              equipmentName.split(",").map((part) => part.trim()).forEach((part) => unavailableParts.add(part));
            }
            scheduled = true;
            scheduledCount += 1;
            break;
          }

          if (!scheduled) skippedCount += 1;
        }
      }

      if (!scheduleOperations.length) {
        showFlash(isJa ? "現在の制限時間では製品を自動配置できませんでした。" : "No products could be scheduled automatically with the current time limit.", "warning");
        return;
      }

      await Promise.all(scheduleOperations);
      await persistPlan(workingProducts, breaks);
      setSmartPreviewOpen(false);
      await refreshAfterMutation(
        isJa
          ? `スマート計画により ${scheduledCount} 件の目標を配置しました${skippedCount ? ` (${skippedCount} 件スキップ)` : ""}。`
          : `Smart scheduling placed ${scheduledCount} goal${scheduledCount === 1 ? "" : "s"}${skippedCount ? `, ${skippedCount} skipped` : ""}.`
      );
    } catch (error) {
      showFlash(error.message || (isJa ? "スマート計画の適用に失敗しました。" : "Failed to apply smart scheduling."), "error");
    } finally {
      setSmartApplying(false);
    }
  }

  function handleOpenCalendar() {
    if (!scheduledProducts.length) {
      showFlash(isJa ? "この日付には計画された製品がありません。" : "No products scheduled for this date.", "warning");
      return;
    }

    try {
      openPlannerCalendarWindow({
        factoryName,
        planDate,
        scheduledProducts,
        breaks,
        startTime,
      });
    } catch (error) {
      showFlash(error.message || (isJa ? "カレンダー表示を開けませんでした。" : "Failed to open calendar view."), "error");
    }
  }

  function handlePrintSelectedEquipment(selectedEquipment) {
    if (!scheduledProducts.length) {
      showFlash(isJa ? "この日付には計画された製品がありません。" : "No products scheduled for this date.", "warning");
      return;
    }

    if (!selectedEquipment.length) {
      showFlash(isJa ? "印刷する設備を1つ以上選択してください。" : "Select at least one equipment to print.", "warning");
      return;
    }

    setPrintModalOpen(false);

    try {
      openPlannerPrintWindow({
        factoryName,
        planDate,
        scheduledProducts,
        selectedEquipment,
        breaks,
        startTime,
      });
    } catch (error) {
      showFlash(error.message || (isJa ? "印刷プレビューを開けませんでした。" : "Failed to open print preview."), "error");
    }
  }

  return (
    <div className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      <FlashBanner flash={flash} onClose={() => setFlash(null)} />
      <PageHeader
        eyebrow={isJa ? "業務運用" : "Operations"}
        title={isJa ? "生産計画" : "Production Planning"}
        subtitle={isJa ? "従来のFreya Adminワークフローを継承した目標ベースの生産計画機能。" : "Goal-based production planning migrated from the original Freya Admin workflow."}
        className="sm:flex-row sm:items-end sm:justify-between"
        actionsClassName="gap-2"
        actions={(
          <>
            <button
              type="button"
              onClick={() => setBreakModalOpen(true)}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-none"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>schedule</span>
              {isJa ? "休憩時間" : "Break Times"}
            </button>
            <button
              type="button"
              onClick={() => loadPlannerData()}
              disabled={loadingFactories || dataLoading}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-none"
            >
              <span className={`material-symbols-outlined ${dataLoading ? "animate-spin" : ""}`} style={{ fontSize: 15 }}>refresh</span>
              {isJa ? "更新" : "Refresh"}
            </button>
          </>
        )}
      />

      <PlannerFilters
        factories={factories}
        factoryName={factoryName}
        planDate={planDate}
        endDate={endDate}
        loading={loadingFactories || dataLoading}
        onFactoryChange={(value) => {
          setFactoryName(value);
          if (value) localStorage.setItem("planner_selected_factory", value);
          else localStorage.removeItem("planner_selected_factory");
          const nextParams = new URLSearchParams(searchParams);
          if (value) nextParams.set("factory", value);
          else nextParams.delete("factory");
          setSearchParams(nextParams, { replace: true });
        }}
        onDateChange={(value) => {
          setPlanDate(value);
          const nextParams = new URLSearchParams(searchParams);
          if (value && value !== todayStr()) nextParams.set("date", value);
          else nextParams.delete("date");
          setSearchParams(nextParams, { replace: true });
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          const nextParams = new URLSearchParams(searchParams);
          if (value) nextParams.set("endDate", value);
          else nextParams.delete("endDate");
          setSearchParams(nextParams, { replace: true });
        }}
        startTime={startTime}
        onStartTimeChange={handleStartTimeChange}
      />

      <div className="space-y-4">
        <MasterTabNav tabs={MAIN_TABS} activeTab={mainTab} onChange={handleMainTabChange} className="mb-4" />

        {mainTab === "goals" && (
          <PlannerGoalsPanel
            goals={filteredGoals}
            currentDate={planDate}
            products={products}
            productColors={productColors}
            scheduledProducts={scheduledProducts}
            goalSearch={goalSearch}
            importing={csvReading}
            smartSchedulingBusy={smartPreviewLoading}
            reconciling={reconciling}
            outOfSyncCount={outOfSyncCount}
            onGoalSearchChange={setGoalSearch}
            onCsvSelected={handleCsvSelected}
            onOpenManualGoal={() => {
              if (!factoryName) {
                showFlash(isJa ? "目標を追加する前に工場を選択してください。" : "Select a factory before adding goals.", "warning");
                return;
              }
              setManualGoalOpen(true);
            }}
            onOpenSmartScheduling={handleOpenSmartScheduling}
            onOpenBulkEdit={() => setBulkEditOpen(true)}
            onReconcileGoals={handleReconcileGoals}
            onReconcileSingleGoal={handleReconcileSingleGoal}
            onDeleteGoal={handleDeleteGoal}
            onScheduleGoal={handleGoalPlanIntent}
          />
        )}

        {mainTab === "preview" && (
          <PlannerPreviewTab
            preview={previewData}
            loading={previewLoading}
            saving={previewSaving}
            publishing={previewPublishing}
            factoryName={factoryName}
            planDate={planDate}
            onRefresh={() => loadPreview(true)}
            onSaveDraft={handleSavePreviewDraft}
            onDiscardDraft={handleDiscardPreviewDraft}
            onPublish={handlePublishFromPreview}
          />
        )}

        {mainTab === "published" && (
          <PlannerPublishedTab
            publishedData={publishedData}
            loading={publishedLoading}
            restoring={publishedRestoring}
            factoryName={factoryName}
            planDate={planDate}
            onRefresh={() => loadPublished(true)}
            onOpenPreview={() => handleMainTabChange("preview")}
            onRestoreVersion={handleRestorePublishedVersion}
            onPrint={() => {
              const activeAssignments = publishedData?.activeSchedule?.assignments || [];
              if (!activeAssignments.length) {
                showFlash(isJa ? "印刷可能な公開スケジュールがありません。" : "No published schedule available to print.", "warning");
                return;
              }
              try {
                openPlannerPrintWindow({
                  factoryName,
                  planDate,
                  scheduledProducts: activeAssignments,
                  breaks,
                  startTime,
                });
              } catch (err) {
                showFlash(err.message || (isJa ? "印刷プレビューを開けませんでした。" : "Failed to open print preview."), "error");
              }
            }}
          />
        )}

        {mainTab === "planning" && (
          <div className="space-y-4">
            <PlannerSelectedSummary
              scheduledProducts={scheduledProducts}
              breaks={breaks}
              startTime={startTime}
              searchValue={selectedSearch}
              onSearchChange={setSelectedSearch}
              onRemoveItem={handleRemoveScheduledItem}
              onClearAll={handleClearAllScheduled}
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <LiquidSegmentedControl items={VIEW_TABS} activeKey={viewTab} onChange={setViewTab} className="inline-flex" />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleOpenCalendar}
                  disabled={!scheduledProducts.length}
                  className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40 transition-colors shadow-none"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>calendar_month</span>
                  {isJa ? "カレンダー表示" : "Calendar View"}
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalOpen(true)}
                  disabled={!scheduledProducts.length}
                  className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-40 transition-colors shadow-none"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>print</span>
                  {isJa ? "印刷" : "Print"}
                </button>
              </div>
            </div>

            {viewTab === "timeline" ? (
              <PlannerTimelineView
                equipment={equipment}
                scheduledProducts={scheduledProducts}
                actualBlocks={actualBlocks}
                inProgressMap={inProgressMap}
                breaks={breaks}
                startTime={startTime}
                onStartTimeChange={handleStartTimeChange}
                unavailableEquipment={unavailableEquipment}
                onOpenMachineStatusModal={() => {
                  if (!factoryName) {
                    showFlash(isJa ? "工場を選択してください。" : "Please select a factory first.", "warning");
                    return;
                  }
                  setMachineStatusModalOpen(true);
                }}
                hideUnavailableEquipment={hideUnavailableEquipment}
                onToggleHideUnavailable={() => setHideUnavailableEquipment((value) => !value)}
                onSlotSelect={(equipmentName, startTime) => {
                  if (!factoryName) {
                    showFlash(isJa ? "製品を計画する前に工場を選択してください。" : "Select a factory before scheduling products.", "warning");
                    return;
                  }
                  setSlotModalState({ open: true, equipment: equipmentName, startTime });
                }}
                onMoveScheduledItem={handleMoveScheduledItem}
                onRemoveScheduledItem={handleRemoveScheduledItem}
              />
            ) : null}

            {viewTab === "kanban" ? (
              <PlannerKanbanView
                equipment={equipment}
                scheduledProducts={scheduledProducts}
                breaks={breaks}
                onMoveItem={handleMoveKanbanItem}
                onRemoveItem={handleRemoveScheduledItem}
              />
            ) : null}

            {viewTab === "table" ? (
              <PlannerTableView
                scheduledProducts={scheduledProducts}
                onRemoveItem={handleRemoveScheduledItem}
              />
            ) : null}
          </div>
        )}
      </div>

      <PlannerBreakModal
        open={breakModalOpen}
        breaks={breaks}
        equipmentOptions={equipment}
        saving={breakSaving}
        onClose={() => setBreakModalOpen(false)}
        onSave={handleSaveBreaks}
      />

      <PlannerPrintModal
        open={printModalOpen}
        equipmentOptions={[...new Set(scheduledProducts.map((item) => item.equipment).filter(Boolean))]}
        onClose={() => setPrintModalOpen(false)}
        onConfirm={handlePrintSelectedEquipment}
      />

      <PlannerManualGoalModal
        open={manualGoalOpen}
        products={products}
        initialDate={planDate}
        submitting={manualGoalSubmitting}
        onClose={() => {
          if (!manualGoalSubmitting) setManualGoalOpen(false);
        }}
        onSubmit={handleManualGoalSubmit}
      />

      <PlannerDuplicateChoiceModal
        open={duplicateState.open}
        existingGoal={duplicateState.existingGoal}
        pendingGoal={duplicateState.pendingGoal}
        busy={duplicateBusy}
        onClose={() => setDuplicateState({ open: false, existingGoal: null, pendingGoal: null })}
        onResolve={handleDuplicateResolution}
      />

      <PlannerGoalImportReviewModal
        open={csvReviewRows.length > 0}
        rows={csvReviewRows}
        importing={csvImporting}
        onClose={() => {
          if (!csvImporting) setCsvReviewRows([]);
        }}
        onConfirm={handleConfirmCsvImport}
      />

      <PlannerSlotSchedulingModal
        open={slotModalState.open}
        equipment={slotModalState.equipment}
        startTime={slotModalState.startTime}
        goals={goals}
        currentDate={planDate}
        unavailableEquipment={unavailableEquipment}
        submitting={slotSubmitting}
        onClose={() => {
          if (!slotSubmitting) setSlotModalState({ open: false, equipment: "", startTime: "" });
        }}
        onConfirm={handleSlotSchedule}
      />

      <PlannerSmartSchedulingModal
        open={smartPreviewOpen}
        assignments={smartPreview?.assignments || {}}
        totalAssigned={smartPreview?.totalAssigned || 0}
        totalUnassigned={smartPreview?.totalUnassigned || 0}
        scheduling={smartApplying}
        onClose={() => {
          if (!smartApplying) setSmartPreviewOpen(false);
        }}
        onConfirm={handleApplySmartScheduling}
      />

      <PlannerBulkEditGoalsModal
        open={bulkEditOpen}
        factoryName={factoryName}
        planDate={planDate}
        goals={goals}
        busy={bulkEditBusy}
        onClose={() => setBulkEditOpen(false)}
        onDeleteSelected={handleBulkDeleteSelected}
        onDeleteAll={handleBulkDeleteAll}
        onUpdateTarget={handleBulkUpdateTarget}
      />

      <PlannerMachineStatusModal
        open={machineStatusModalOpen}
        onClose={() => setMachineStatusModalOpen(false)}
        factoryName={factoryName}
        equipment={equipment}
        unavailableEquipment={unavailableEquipment}
        onUpdateStatus={handleUpdateMachineStatus}
      />
    </div>
  );
}