import { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
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
import {
  batchCreatePlannerGoals,
  checkPlannerGoalDuplicates,
  createPlannerGoal,
  deletePlannerGoal,
  deletePlannerPlanByFactoryDate,
  fetchPlannerActualProduction,
  fetchPlannerEquipment,
  fetchPlannerFactories,
  fetchPlannerGoals,
  fetchPlannerInProgress,
  fetchPlannerPlans,
  fetchPlannerPressHistory,
  fetchPlannerProducts,
  lookupPlannerProduct,
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
  isGroupEquipment,
  minutesToTime,
  normalizePlanProducts,
  processActualProductionData,
  processInProgressData,
  timeToMinutes,
} from "../utils/planner";
import { openPlannerCalendarWindow, openPlannerPrintWindow } from "../utils/plannerExports";

const MAIN_TABS = [
  { key: "goals", label: "Production Goals" },
  { key: "planning", label: "Planning" },
];

const VIEW_TABS = [
  { key: "timeline", label: "Timeline" },
  { key: "kanban", label: "Kanban" },
  { key: "table", label: "Table" },
];

const SMART_SCHEDULING_GRACE_MINUTES = 30;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function FlashBanner({ flash, onClose }) {
  if (!flash) return null;

  const tone = flash.type === "error"
    ? "border-error/20 bg-error/10 text-error"
    : flash.type === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : flash.type === "warning"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-primary/20 bg-primary/10 text-primary";

  return (
    <div className={`mb-6 rounded-3xl border px-5 py-4 ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">Status</div>
          <p className="mt-1 text-sm font-medium">{flash.message}</p>
        </div>
        <button type="button" onClick={onClose} className="text-current/70 transition hover:text-current">
          <span className="material-symbols-outlined">close</span>
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
  const authUser = getAuthUser();
  const requestIdRef = useRef(0);
  const [factories, setFactories] = useState([]);
  const [factoryName, setFactoryName] = useState(() => localStorage.getItem("planner_selected_factory") || "");
  const [planDate, setPlanDate] = useState(todayStr());
  const [endDate, setEndDate] = useState("");
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
  const [mainTab, setMainTab] = useState("goals");
  const [viewTab, setViewTab] = useState("timeline");
  const [goalSearch, setGoalSearch] = useState("");
  const [selectedSearch, setSelectedSearch] = useState("");
  const [flash, setFlash] = useState(null);
  const [hideUnavailableEquipment, setHideUnavailableEquipment] = useState(false);
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

  const productColors = buildProductColorMap(products, [...goals, ...scheduledProducts]);
  const filteredGoals = filterGoals(goals, goalSearch);

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
      setEquipment([]);
      setGoals([]);
      setScheduledProducts([]);
      setActualBlocks([]);
      setInProgressMap({});
      setBreaks(cloneBreaks(DEFAULT_BREAKS));
      setCurrentPlanId("");
      return;
    }

    const requestId = ++requestIdRef.current;
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

      if (requestId !== requestIdRef.current) return;

      const nextColorMap = buildProductColorMap(nextProducts, nextGoals);
      const currentPlan = Array.isArray(nextPlans) && nextPlans.length ? nextPlans[0] : null;

      setEquipment(nextEquipment);
      setProducts(nextProducts);
      setGoals(nextGoals);
      setScheduledProducts(normalizePlanProducts(currentPlan?.products || [], nextProducts, nextColorMap));
      setActualBlocks(processActualProductionData(actualRows));
      setInProgressMap(processInProgressData(inProgressRows));
      setBreaks(currentPlan?.breaks?.length ? cloneBreaks(currentPlan.breaks) : cloneBreaks(DEFAULT_BREAKS));
      setCurrentPlanId(currentPlan?._id || "");
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
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

  async function persistPlan(nextProducts, nextBreaks) {
    if (!factoryName) return;

    if (!nextProducts.length) {
      await deletePlannerPlanByFactoryDate(factoryName, planDate);
      setCurrentPlanId("");
      return;
    }

    await upsertPlannerPlan({
      factory: factoryName,
      date: planDate,
      products: serializePlanProducts(nextProducts),
      breaks: cloneBreaks(nextBreaks),
      createdBy: getUserDisplayName(authUser),
    });
  }

  async function refreshAfterMutation(message, type = "success") {
    await loadPlannerData();
    if (message) showFlash(message, type);
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
      setMainTab("planning");
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
    setMainTab("planning");
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
      const preview = buildSmartAssignments(goals, planDate, result?.trends || {}, products);
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
            if (!isGroupEquipment(equipmentName) && unavailableParts.has(equipmentName)) continue;

            if (isGroupEquipment(equipmentName)) {
              const parts = equipmentName.split(",").map((part) => part.trim());
              const hasPartConflict = parts.some((part) => workingProducts.some((item) => item.equipment === part));
              if (hasPartConflict) continue;
            }

            const currentStartMinutes = getLatestEquipmentEnd(workingProducts, equipmentName, breaks);
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
        showFlash("No products could be scheduled automatically with the current time limit.", "warning");
        return;
      }

      await Promise.all(scheduleOperations);
      await persistPlan(workingProducts, breaks);
      setSmartPreviewOpen(false);
      await refreshAfterMutation(`Smart scheduling placed ${scheduledCount} goal${scheduledCount === 1 ? "" : "s"}${skippedCount ? `, ${skippedCount} skipped` : ""}.`);
    } catch (error) {
      showFlash(error.message || "Failed to apply smart scheduling.", "error");
    } finally {
      setSmartApplying(false);
    }
  }

  function handleOpenCalendar() {
    if (!scheduledProducts.length) {
      showFlash("No products scheduled for this date.", "warning");
      return;
    }

    try {
      openPlannerCalendarWindow({
        factoryName,
        planDate,
        scheduledProducts,
        breaks,
      });
    } catch (error) {
      showFlash(error.message || "Failed to open calendar view.", "error");
    }
  }

  function handlePrintSelectedEquipment(selectedEquipment) {
    if (!scheduledProducts.length) {
      showFlash("No products scheduled for this date.", "warning");
      return;
    }

    if (!selectedEquipment.length) {
      showFlash("Select at least one equipment to print.", "warning");
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
      });
    } catch (error) {
      showFlash(error.message || "Failed to open print preview.", "error");
    }
  }

  return (
    <section className="h-screen overflow-y-auto px-4 pb-24 pt-20 scrollbar-hide sm:px-6 sm:pb-16 sm:pt-24 md:px-8">
      <FlashBanner flash={flash} onClose={() => setFlash(null)} />
      <PageHeader
        title="Production Planning"
        subtitle="Goal-based production planning migrated from the original Freya Admin workflow."
        className="sm:flex-row sm:items-end sm:justify-between"
        actionsClassName="gap-2"
        actions={(
          <>
            <button
              type="button"
              onClick={() => setBreakModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
              Break Times
            </button>
            <button
              type="button"
              onClick={() => loadPlannerData()}
              disabled={loadingFactories || dataLoading}
              className="flex items-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={`material-symbols-outlined ${dataLoading ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>refresh</span>
              Refresh
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
        }}
        onDateChange={setPlanDate}
        onEndDateChange={setEndDate}
      />

      <div className="mt-6 rounded-3xl border border-outline-variant/15 bg-transparent">
        <div className="mb-4">
          <LiquidSegmentedControl items={MAIN_TABS} activeKey={mainTab} onChange={setMainTab} className="inline-flex" />
        </div>

        {mainTab === "goals" ? (
          <PlannerGoalsPanel
            goals={filteredGoals}
            currentDate={planDate}
            products={products}
            productColors={productColors}
            scheduledProducts={scheduledProducts}
            goalSearch={goalSearch}
            importing={csvReading}
            smartSchedulingBusy={smartPreviewLoading}
            onGoalSearchChange={setGoalSearch}
            onCsvSelected={handleCsvSelected}
            onOpenManualGoal={() => {
              if (!factoryName) {
                showFlash("Select a factory before adding goals.", "warning");
                return;
              }
              setManualGoalOpen(true);
            }}
            onOpenSmartScheduling={handleOpenSmartScheduling}
            onDeleteGoal={handleDeleteGoal}
            onScheduleGoal={handleGoalPlanIntent}
          />
        ) : (
          <div className="space-y-4">
            <PlannerSelectedSummary
              scheduledProducts={scheduledProducts}
              breaks={breaks}
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
                  className="flex items-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_month</span>
                  Calendar View
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalOpen(true)}
                  disabled={!scheduledProducts.length}
                  className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>print</span>
                  Print
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
                hideUnavailableEquipment={hideUnavailableEquipment}
                onToggleHideUnavailable={() => setHideUnavailableEquipment((value) => !value)}
                onSlotSelect={(equipmentName, startTime) => {
                  if (!factoryName) {
                    showFlash("Select a factory before scheduling products.", "warning");
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
    </section>
  );
}