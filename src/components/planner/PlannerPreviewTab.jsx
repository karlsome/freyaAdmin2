import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { isEquipmentUnavailable } from "../../utils/planner";
import {
  adjustBoxes,
  applyDrop,
  blockLabel,
  buildBasisRows,
  buildDraftSimulation,
  buildSimulation,
  createPreviewContext,
  draftIdOf,
  getInsertOptions,
  insertException,
  normalizeAssignments,
  priorityRowMapOf,
} from "../../utils/plannerPreviewEngine";
import PlannerPreviewTimeline from "./PlannerPreviewTimeline";
import { PlannerDraftInsertModal, PlannerDraftQuantityModal } from "./PlannerPreviewDraftModals";

function getMoveMessage(result, isJa) {
  const block = result.block || (isJa ? "ブロック" : "This block");
  switch (result.messageKey) {
    case "selectValidLane": return isJa ? "有効な設備レーンを選択してください。" : "Select a valid machine lane for this draft move.";
    case "ineligible": return isJa ? `${block} は ${result.equipment} では稼働できません（停止中）。` : `${block} cannot run on ${result.equipment} (machine is down).`;
    case "invalidSlot": return isJa ? "有効な15分枠を選択してください。" : "Choose a valid 15-minute slot.";
    case "breakSlot": return isJa ? "休憩時間内です。稼働中の枠にドロップしてください。" : "That slot is inside a break. Drop the block on a working tile.";
    case "invalidStartTile": return isJa ? "この枠は開始位置にできません。" : "That tile cannot be used as the block start.";
    case "movePastLimit": return isJa ? `この移動では ${result.time} を超えてしまいます。` : `This move would push the block beyond ${result.time}.`;
    case "swapPastLimit": return isJa ? `この入替では ${block} が ${result.time} を超えてしまいます。` : `This swap would push ${block} beyond ${result.time}.`;
    case "overlap": return isJa ? "対象設備の他のブロックと重なります。" : "That slot overlaps another block on the target machine.";
    case "chooseAnother": return isJa ? "入れ替える別のブロックを選んでください。" : "Choose another block to swap with.";
    case "swapNotFound": return isJa ? "対象の下書きブロックが見つかりません。" : "The draft block could not be located.";
    case "insertFailed": return isJa ? "この枠に不足ラインを追加できません。" : "Unable to add that shortage line to this slot.";
    default: return isJa ? "この操作はできません。" : "That draft change is not available.";
  }
}

export default function PlannerPreviewTab({
  preview,
  loading = false,
  saving = false,
  publishing = false,
  factoryName,
  planDate,
  breaks = [],
  unavailableEquipment = [],
  productColors = {},
  equipmentOptions = [],
  onNotify,
  onRefresh,
  onSaveDraft,
  onDiscardDraft,
  onPublish,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const renderT0Ref = useRef(performance.now());
  renderT0Ref.current = performance.now();

  const [activeSubTab, setActiveSubTab] = useState("priority"); // "priority" | "inventory"
  const [scheduleUntil, setScheduleUntil] = useState("17:30");
  const [note, setNote] = useState("");

  // Local, unsaved draft edits. null = no local draft yet.
  const [viewMode, setViewMode] = useState(null); // null (auto-pick) | "auto" | "draft"
  const [draft, setDraft] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [insertTarget, setInsertTarget] = useState(null);
  const [quantityId, setQuantityId] = useState(null);

  const notify = (message, type = "info") => onNotify?.(message, type);

  useEffect(() => {
    console.log(`✅ [PlannerPreviewTab] Rendered to DOM in ${(performance.now() - renderT0Ref.current).toFixed(1)}ms`);
  });

  // Leaving the factory/date drops local edits.
  useEffect(() => {
    setDraft(null);
    setViewMode(null);
    setEditMode(false);
    setInsertTarget(null);
    setQuantityId(null);
  }, [factoryName, planDate]);

  const priorityRows = useMemo(() => (Array.isArray(preview?.priorityRows) ? preview.priorityRows : []), [preview]);
  const inventoryRows = Array.isArray(preview?.inventoryRows) ? preview.inventoryRows : [];
  const savedDraft = preview?.savedDraft || null;

  const ctx = useMemo(
    () => createPreviewContext({ priorityRows, breaks, unavailableEquipment, scheduleUntilTime: scheduleUntil, productColors }),
    [priorityRows, breaks, unavailableEquipment, scheduleUntil, productColors],
  );
  const priorityRowMap = useMemo(() => priorityRowMapOf(priorityRows), [priorityRows]);

  const autoSim = useMemo(() => buildSimulation(ctx, priorityRows), [ctx, priorityRows]);
  const savedAssignments = useMemo(
    () => (Array.isArray(savedDraft?.assignments) && savedDraft.assignments.length > 0 ? normalizeAssignments(ctx, savedDraft.assignments) : []),
    [ctx, savedDraft],
  );
  const hasSaved = savedAssignments.length > 0;
  const hasDraft = draft !== null || hasSaved;
  const effectiveView = (viewMode ?? (hasSaved ? "draft" : "auto")) === "draft" && hasDraft ? "draft" : "auto";
  const draftAssignments = draft ?? savedAssignments;

  const basisRows = useMemo(() => {
    const saved = Array.isArray(savedDraft?.basisRows) ? savedDraft.basisRows : [];
    return saved.length > 0 ? saved : buildBasisRows(priorityRows);
  }, [savedDraft, priorityRows]);

  const draftSim = useMemo(
    () => (hasDraft ? buildDraftSimulation(ctx, priorityRows, basisRows, draftAssignments) : null),
    [ctx, priorityRows, basisRows, draftAssignments, hasDraft],
  );
  const sim = effectiveView === "draft" && draftSim ? draftSim : autoSim;
  const isEditing = editMode && effectiveView === "draft" && draft !== null;

  const laneNames = useMemo(() => {
    const names = new Set(sim.equipmentList);
    if (isEditing) {
      (equipmentOptions || []).forEach((name) => {
        const text = String(name || "").trim();
        if (text && !isEquipmentUnavailable(text, unavailableEquipment)) names.add(text);
      });
    }
    return Array.from(names).sort((l, r) => l.localeCompare(r));
  }, [sim.equipmentList, isEditing, equipmentOptions, unavailableEquipment]);

  const insertOptions = useMemo(() => (
    insertTarget && draft
      ? getInsertOptions(ctx, priorityRowMap, normalizeAssignments(ctx, draft), draftSim?.exceptions || [], insertTarget.equipment, insertTarget.time)
      : []
  ), [insertTarget, draft, ctx, priorityRowMap, draftSim]);

  const quantityAssignment = quantityId && draft ? draft.find((a) => draftIdOf(a) === quantityId) || null : null;

  const rawAssignments = sim.assignments;

  // ─── Draft actions ────────────────────────────────────────────────────────
  function startEditing() {
    if (draft === null) {
      const seed = hasSaved ? savedAssignments : autoSim.assignments;
      if (seed.length === 0) {
        notify(isJa ? "下書きにできるプレビュー行がありません。" : "No preview rows are available to draft yet.", "warning");
        return;
      }
      setDraft(normalizeAssignments(ctx, seed));
      notify(isJa
        ? "下書きを作成しました。ブロックをドラッグで移動、別のブロックにドロップで入替できます。"
        : "Preview Draft created. Drag a block to move it, or drop it onto another block to swap and auto-arrange timing.", "success");
    }
    setViewMode("draft");
    setEditMode(true);
  }

  function stopEditing() {
    setEditMode(false);
    setInsertTarget(null);
    setQuantityId(null);
  }

  function resetDraft() {
    setDraft(null);
    setEditMode(false);
    setInsertTarget(null);
    setQuantityId(null);
    setViewMode(hasSaved ? "draft" : "auto");
    notify(hasSaved
      ? (isJa ? "未保存の変更を破棄し、保存済み下書きを表示します。" : "Unsaved draft changes discarded. Showing the saved draft again.")
      : (isJa ? "下書きを自動計画に戻しました。" : "Preview Draft reset to the auto-generated calendar."), "success");
  }

  function handleDrop(draggedId, equipment, time) {
    if (!draft) return;
    const result = applyDrop(ctx, draft, draggedId, equipment, time);
    if (!result.ok) {
      notify(getMoveMessage(result, isJa), "warning");
      return;
    }
    setDraft(result.assignments);
    if (result.kind === "swap") {
      const a = blockLabel(result.moving, "Block");
      const b = blockLabel(result.target, "block");
      notify(isJa
        ? `${a} と ${b} を入れ替えました${result.startTimesChanged ? "（時間を自動調整）" : ""}。`
        : `${a} swapped with ${b}${result.startTimesChanged ? " and the lane timing was auto-arranged" : ""}.`, "success");
    } else {
      notify(isJa
        ? `${blockLabel(result.moving, "Block")} を ${result.moving.equipment} の ${result.moving.startTime} に移動しました。`
        : `${blockLabel(result.moving, "Block")} moved to ${result.moving.startTime} on ${result.moving.equipment}.`, "success");
    }
  }

  function handleAdjust(delta) {
    if (!draft || !quantityId) return;
    const result = adjustBoxes(ctx, draft, quantityId, delta);
    if (!result.ok) {
      notify(result.messageKey ? getMoveMessage(result, isJa) : (isJa ? "数量を調整できません。" : "Unable to adjust the draft quantity for this block."), "warning");
      return;
    }
    if (result.unchanged) return;
    setDraft(result.assignments);
    if (result.removed) setQuantityId(null);
  }

  function handleInsert(exception) {
    if (!draft || !insertTarget) return;
    const result = insertException(ctx, priorityRowMap, draft, exception, insertTarget.equipment, insertTarget.time);
    if (!result.ok) {
      notify(getMoveMessage(result, isJa), "warning");
      return;
    }
    setDraft(result.assignments);
    setInsertTarget(null);
    notify(isJa
      ? `${blockLabel(result.assignment, "Block")} を ${result.assignment.equipment} の ${result.assignment.startTime} に追加しました。`
      : `${blockLabel(result.assignment, "Block")} added at ${result.assignment.startTime} on ${result.assignment.equipment}.`, "success");
  }

  async function handleSave() {
    const assignments = normalizeAssignments(ctx, effectiveView === "draft" ? draftAssignments : autoSim.assignments);
    const ok = await onSaveDraft?.({ scheduleUntilTime: ctx.scheduleUntilTime, assignments, basisRows: buildBasisRows(priorityRows) });
    if (ok !== false) {
      setDraft(null);
      setEditMode(false);
      setInsertTarget(null);
      setQuantityId(null);
      setViewMode("draft");
    }
  }

  async function handleDiscardSaved() {
    if (!window.confirm(isJa
      ? "保存済みの下書きを削除して自動表示に戻しますか？未保存の変更も破棄されます。"
      : "Delete the saved Preview Draft and return to Auto view? Any unsaved local draft changes will also be discarded.")) return;
    await onDiscardDraft?.();
    setDraft(null);
    setEditMode(false);
    setViewMode("auto");
  }

  if (!factoryName) {
    return (
      <div className="freya-card rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center text-[var(--text-muted)]">
        <span className="material-symbols-outlined text-4xl text-[var(--freya-blue)] mb-2">radar</span>
        <p className="text-base font-semibold text-[var(--text-primary)]">
          {isJa ? "工場を選択してください" : "Select a factory"}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {isJa ? "需要キュー（NODA引当不足）と在庫情報を照合して自動計画プレビューを作成します。" : "Select a factory above to compare current inventory, customer demand, and auto-planning draft."}
        </p>
      </div>
    );
  }

  if (loading && !preview) {
    return (
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--freya-blue)] border-t-transparent" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {isJa ? "需要自動計画プレビューを構築中…" : "Building auto-plan preview…"}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {isJa ? "未完了不足ライン、現在在庫、および機械割当を収集しています。" : "Collecting unfinished shortages, FIFO inventory, and equipment assignments."}
        </p>
      </div>
    );
  }

  const isStale = savedDraft?.basisComparison?.isStale === true;

  return (
    <div className="space-y-4">
      {/* ── Top Summary & Actions Strip ── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {isJa ? "需要自動計画プレビュー" : "Demand-Driven Auto Planning Preview"}
              </h3>
              {savedDraft && (
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                  {isJa ? "保存済下書き" : "Saved Draft"}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {isJa
                ? "納入指示日順の不足キューを現在在庫(FIFO)と突合し、機械別に最適な順序で自動配置します。"
                : "Matches customer shortage demand against FIFO inventory and auto-assigns eligible machines."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRefresh?.(true)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition-colors"
            >
              <span className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`} style={{ fontSize: 15 }}>refresh</span>
              {isJa ? "再計算" : "Refresh"}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || rawAssignments.length === 0}
              className="flex items-center gap-1.5 rounded-[6px] border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>save</span>
              {saving ? (isJa ? "保存中…" : "Saving…") : (isJa ? "下書き保存" : "Save Draft")}
            </button>

            {savedDraft && (
              <button
                type="button"
                onClick={handleDiscardSaved}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-[6px] border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete_sweep</span>
                {isJa ? "下書き破棄" : "Discard Draft"}
              </button>
            )}

            <button
              type="button"
              onClick={() => onPublish?.({
                scheduleUntilTime: scheduleUntil,
                sourceMode: effectiveView === "draft" ? "draft" : "auto",
                sourceType: "auto-demand",
                sourceLabel: isJa ? "需要計画プレビューから公開" : "Published from Demand Preview",
                note,
                assignments: rawAssignments,
                basisRows: priorityRows,
              })}
              disabled={publishing || rawAssignments.length === 0}
              className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>publish</span>
              {publishing ? (isJa ? "公開中…" : "Publishing…") : (isJa ? "現場へ公開" : "Publish Schedule")}
            </button>
          </div>
        </div>

        {/* Stale Warning Banner */}
        {isStale && (
          <div className="mt-3 flex items-center gap-2 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="material-symbols-outlined text-amber-600" style={{ fontSize: 16 }}>warning</span>
            <span>
              {isJa
                ? "保存された下書きは古い不足データに基づいています。変更を反映するには再保存または再計算してください。"
                : "Saved preview draft is based on older shortage queue data. Save again to update the baseline."}
            </span>
          </div>
        )}

        {/* KPI Strip */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {isJa ? "不足ライン件数" : "Shortage Lines"}
            </div>
            <div className="mt-1 text-base font-bold text-[var(--text-primary)] font-mono">
              {priorityRows.length.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">{isJa ? "件" : "lines"}</span>
            </div>
          </div>

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {isJa ? "自動計画割当数" : "Planned Assignments"}
            </div>
            <div className="mt-1 text-base font-bold text-[var(--freya-blue)] font-mono">
              {rawAssignments.length.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">{isJa ? "枠" : "slots"}</span>
            </div>
          </div>

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {isJa ? "計画割当数量" : "Scheduled Qty"}
            </div>
            <div className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {Number(sim.scheduledShortfallQuantity || 0).toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">{isJa ? "個" : "pcs"}</span>
            </div>
          </div>

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {isJa ? "未計画残不足" : "Unscheduled Shortfall"}
            </div>
            <div className={`mt-1 text-base font-bold font-mono ${(sim.unscheduledShortfallQuantity || 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {Number(sim.unscheduledShortfallQuantity || 0).toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">{isJa ? "個" : "pcs"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs: Priority Shortage Table vs Inventory Table ── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-2.5 bg-[var(--surface-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab("priority")}
              className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-colors ${
                activeSubTab === "priority"
                  ? "bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {isJa ? `不足優先順位キュー (${priorityRows.length})` : `Shortage Priority Queue (${priorityRows.length})`}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("inventory")}
              className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-colors ${
                activeSubTab === "inventory"
                  ? "bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {isJa ? `現在庫スナップショット (${inventoryRows.length})` : `Inventory Snapshot (${inventoryRows.length})`}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{isJa ? "計画終了予定:" : "Schedule Until:"}</span>
            <input
              type="time"
              value={scheduleUntil}
              onChange={(e) => setScheduleUntil(e.target.value)}
              className="h-7 rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text-primary)] font-mono outline-none"
            />
          </div>
        </div>

        <div className="p-4 max-h-[380px] overflow-y-auto">
          {activeSubTab === "priority" ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold w-12 text-center">{isJa ? "優先順" : "Rank"}</th>
                    <th className="px-3 py-2 font-semibold">{isJa ? "依頼番号" : "Request #"}</th>
                    <th className="px-3 py-2 font-semibold">{isJa ? "背番号" : "背番号"}</th>
                    <th className="px-3 py-2 font-semibold">{isJa ? "品番" : "品番"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "不足数量" : "Shortfall Qty"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "不足箱数" : "Boxes"}</th>
                    <th className="px-3 py-2 font-semibold">{isJa ? "割当可能設備" : "Eligible Machines"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]">
                  {priorityRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                        {isJa ? "現在、未充足の不足依頼はありません。" : "No unfinished shortage line items waiting."}
                      </td>
                    </tr>
                  ) : (
                    priorityRows.map((row, index) => (
                      <tr key={row._id || index} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="px-3 py-2 text-center font-mono font-semibold text-[var(--text-secondary)]">
                          {row.priorityRank || index + 1}
                        </td>
                        <td className="px-3 py-2 font-mono font-medium text-[var(--freya-blue)]">
                          {row.requestNumber || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold">{row.背番号 || "—"}</td>
                        <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{row.品番 || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          {Number(row.shortfallQuantity || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--text-secondary)]">
                          {row.shortageBoxes != null ? Number(row.shortageBoxes).toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)] truncate max-w-[200px]">
                          {Array.isArray(row.eligibleMachines) && row.eligibleMachines.length
                            ? row.eligibleMachines.join(", ")
                            : (isJa ? "未指定 / 全台" : "All available")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{isJa ? "背番号" : "背番号"}</th>
                    <th className="px-3 py-2 font-semibold">{isJa ? "品番" : "品番"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "現在庫数 (実数)" : "Physical Stock"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "引当済数" : "Reserved"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "引当可能数" : "Available"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "未充足不足数" : "Shortage"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]">
                  {inventoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                        {isJa ? "対象製品の在庫情報がありません。" : "No inventory data available for current scope."}
                      </td>
                    </tr>
                  ) : (
                    inventoryRows.map((inv, index) => (
                      <tr key={inv._id || index} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="px-3 py-2 font-mono font-semibold text-[var(--freya-blue)]">{inv.背番号 || "—"}</td>
                        <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{inv.品番 || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {Number(inv.physicalQuantity || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--text-secondary)]">
                          {Number(inv.reservedQuantity || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--text-primary)]">
                          {Number(inv.availableQuantity || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          {Number(inv.pendingShortfallQuantity || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Auto-Plan Calendar Grid (Lane Schedule) ── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              {isJa ? "自動計画タイムライン割当プレビュー" : "Planned Preview Timeline Schedule"}
            </h4>
            <p className="text-xs text-[var(--text-secondary)]">
              {isEditing
                ? (isJa
                  ? "ブロックをドラッグで移動／別ブロックへドロップで入替。空き枠をクリックで時間超過ラインを追加、ブロックをクリックで箱数を調整。"
                  : "Drag a block to move it, drop on another block to swap. Click an empty slot to add a shortage line, click a block to adjust boxes.")
                : (isJa
                  ? `設備別稼働時間帯 (${scheduleUntil} まで) に沿って自動配置された作業スロットです。`
                  : `Simulated assignment blocks scheduled across machine lanes up to ${scheduleUntil}.`)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-[6px] border border-[var(--border)] text-xs font-semibold">
              <button
                type="button"
                onClick={() => { stopEditing(); setViewMode("auto"); }}
                className={`px-3 py-1.5 transition-colors ${effectiveView === "auto" ? "bg-[var(--freya-blue)] text-white" : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
              >
                {isJa ? "自動表示" : "View Auto"}
              </button>
              <button
                type="button"
                disabled={!hasDraft}
                onClick={() => { stopEditing(); setViewMode("draft"); }}
                className={`border-l border-[var(--border)] px-3 py-1.5 transition-colors disabled:opacity-40 ${effectiveView === "draft" ? "bg-[var(--freya-blue)] text-white" : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
              >
                {isJa ? "下書き表示" : "View Draft"}
              </button>
            </div>

            <button
              type="button"
              onClick={isEditing ? stopEditing : startEditing}
              disabled={saving}
              className={`flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${isEditing ? "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{isEditing ? "lock_open" : "edit_calendar"}</span>
              {isEditing ? (isJa ? "編集を終了" : "Stop Editing") : (isJa ? "下書きを編集" : "Edit Draft")}
            </button>

            {draft !== null && (
              <button
                type="button"
                onClick={resetDraft}
                className="flex items-center gap-1.5 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>restart_alt</span>
                {isJa ? "変更を破棄" : "Reset Changes"}
              </button>
            )}

            <span className="font-mono text-xs text-[var(--text-muted)]">
              {sim.equipmentList.length} {isJa ? "台の設備" : "machines"} · {rawAssignments.length} {isJa ? "件の計画" : "jobs"}
              {draft !== null ? (isJa ? " · 未保存" : " · unsaved") : ""}
            </span>
          </div>
        </div>

        <PlannerPreviewTimeline
          ctx={ctx}
          assignments={rawAssignments}
          equipmentNames={laneNames}
          editMode={isEditing}
          onDrop={handleDrop}
          onSlotClick={(equipment, time) => setInsertTarget({ equipment, time })}
          onBlockClick={(assignment) => setQuantityId(draftIdOf(assignment))}
        />

        {/* Exceptions: lines that did not fit / have no machine mapping */}
        {sim.exceptions.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-semibold text-[var(--text-primary)]">
              {isJa ? `未割当ライン (${sim.exceptions.length})` : `Unscheduled Lines (${sim.exceptions.length})`}
            </div>
            <div className="overflow-x-auto rounded-[6px] border border-[var(--border)]">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-3 py-1.5 font-semibold">{isJa ? "理由" : "Reason"}</th>
                    <th className="px-3 py-1.5 font-semibold">{isJa ? "依頼番号" : "Request #"}</th>
                    <th className="px-3 py-1.5 font-semibold">{isJa ? "背番号" : "背番号"}</th>
                    <th className="px-3 py-1.5 text-right font-semibold">{isJa ? "不足数量" : "Shortfall Qty"}</th>
                    <th className="px-3 py-1.5 font-semibold">{isJa ? "候補設備" : "Candidates"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                  {sim.exceptions.map((exception, index) => (
                    <tr key={`${exception.id}-${index}`}>
                      <td className="px-3 py-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${exception.reason === "time-limit" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-rose-500/15 text-rose-700 dark:text-rose-300"}`}>
                          {exception.reason === "time-limit"
                            ? (isJa ? "時間超過" : "Time limit")
                            : ({ unmapped: isJa ? "未設定" : "Unmapped", disabled: isJa ? "無効" : "Disabled", empty: isJa ? "設備なし" : "No machines" }[exception.reason] || exception.reason)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[var(--freya-blue)]">{exception.requestNumber || "—"}</td>
                      <td className="px-3 py-1.5 font-mono font-semibold">{exception.背番号 || exception.品番 || "—"}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{Number(exception.shortfallQuantity || 0).toLocaleString()}</td>
                      <td className="px-3 py-1.5 font-mono text-[var(--text-secondary)]">{(exception.candidateEquipment || []).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isEditing && insertTarget && (
        <PlannerDraftInsertModal
          target={insertTarget}
          options={insertOptions}
          onPick={handleInsert}
          onClose={() => setInsertTarget(null)}
        />
      )}
      {isEditing && quantityAssignment && (
        <PlannerDraftQuantityModal
          ctx={ctx}
          assignment={quantityAssignment}
          onAdjust={handleAdjust}
          onClose={() => setQuantityId(null)}
        />
      )}
    </div>
  );
}
