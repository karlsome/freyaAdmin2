import { useEffect, useMemo, useRef } from "react";
import {
  equipmentConflicts,
  getBrokenDownEquipmentCount,
  getEquipmentUnavailableInfo,
  getFirstVisibleSlotMinutes,
  getProductForSlot,
  getTimelineSlots,
  isBreakAtSlot,
  isEquipmentUnavailable,
  isGroupEquipment,
  minutesToTime,
  timeToMinutes,
} from "../../utils/planner";
import { useLanguage } from "../../contexts/LanguageContext";

const SLOT_WIDTH = 56;
const LABEL_WIDTH = 132;

function getEquipmentAvailabilityFlag(equipment, items = []) {
  return items.some((item) => item.equipment !== equipment && equipmentConflicts(equipment, item.equipment));
}

function getActualBlockForSlot(slotMinutes, equipment, actualBlocks = []) {
  return actualBlocks.find((item) => {
    if (item.equipment !== equipment) return false;
    const start = timeToMinutes(item.startTime);
    const end = timeToMinutes(item.endTime);
    return slotMinutes >= start && slotMinutes < end;
  }) || null;
}

function dropPayload(event) {
  try {
    return JSON.parse(event.dataTransfer.getData("application/planner-item"));
  } catch {
    return null;
  }
}

export default function PlannerTimelineView({
  equipment = [],
  scheduledProducts = [],
  actualBlocks = [],
  inProgressMap = {},
  breaks = [],
  unavailableEquipment = {},
  hideUnavailableEquipment = false,
  startTime = "08:45",
  onToggleHideUnavailable,
  onStartTimeChange,
  onOpenMachineStatusModal,
  onSlotSelect,
  onMoveScheduledItem,
  onRemoveScheduledItem,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const renderT0Ref = useRef(performance.now());
  renderT0Ref.current = performance.now();

  const brokenDownCount = getBrokenDownEquipmentCount(equipment, unavailableEquipment);

  const timeSlots = useMemo(() => {
    return getTimelineSlots(scheduledProducts, actualBlocks, breaks, startTime);
  }, [scheduledProducts, actualBlocks, breaks, startTime]);
  const now = new Date();
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  const timelineStart = timeToMinutes(timeSlots[0] || startTime || "08:45");
  const currentMarkerPosition = currentMinutes >= timelineStart
    ? (((currentMinutes - timelineStart) / 15) * SLOT_WIDTH) + LABEL_WIDTH
    : null;

  const mappedSlots = useMemo(() => {
    return timeSlots.map((slot) => ({
      slot,
      slotMinutes: timeToMinutes(slot),
    }));
  }, [timeSlots]);

  const scheduledProductsWithSlot = useMemo(() => {
    return scheduledProducts.map((p) => ({
      ...p,
      _firstSlot: getFirstVisibleSlotMinutes(p, breaks, startTime),
    }));
  }, [scheduledProducts, breaks, startTime]);

  console.log(`⏱️ [PlannerTimelineView] Rendering timeline grid: ${equipment.length} equipment × ${timeSlots.length} slots (${equipment.length * timeSlots.length * 2} cells), ${scheduledProducts.length} scheduled items`);

  useEffect(() => {
    console.log(`✅ [PlannerTimelineView] Rendered to DOM in ${(performance.now() - renderT0Ref.current).toFixed(1)}ms`);
  });

  if (!equipment.length) {
    return (
      <div className="rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-14 text-center text-[var(--text-muted)]">
        <span className="material-symbols-outlined text-3xl text-[var(--text-muted)]">calendar_month</span>
        <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
          {isJa ? "設備が読み込まれていません" : "No equipment loaded"}
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {isJa ? "工場を選択して計画タイムラインを作成してください。" : "Choose a factory to build the planning timeline."}
        </p>
      </div>
    );
  }

  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {isJa ? "タイムライン表示" : "Timeline View"}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {isJa ? "設備ごとに製品を配置し、計画と実績の比較を行います。" : "Place products on equipment rows and compare planned output against actual production."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenMachineStatusModal ? (
            <button
              type="button"
              onClick={onOpenMachineStatusModal}
              className={`flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition shadow-2xs cursor-pointer ${brokenDownCount > 0 ? "border-amber-400/60 bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20" : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"}`}
            >
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>build</span>
              <span>{isJa ? "設備状況" : "Machine Status"}</span>
              {brokenDownCount > 0 ? (
                <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] font-bold text-white leading-tight">
                  {brokenDownCount}
                </span>
              ) : null}
            </button>
          ) : null}

          {onStartTimeChange ? (
            <div className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>schedule</span>
              <span>{isJa ? "開始:" : "Start:"}</span>
              <input
                type="time"
                value={startTime || "08:45"}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="h-6 rounded bg-[var(--surface)] border border-[var(--border)] px-1.5 text-xs font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--freya-blue)] cursor-pointer"
                title={isJa ? "タイムライン開始時刻" : "Timeline start time"}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={onToggleHideUnavailable}
            className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${hideUnavailableEquipment ? "border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]" : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"}`}
          >
            {hideUnavailableEquipment
              ? (isJa ? "利用不可設備を表示" : "Show unavailable equipment")
              : (isJa ? "利用不可設備を非表示" : "Hide unavailable equipment")}
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)]">
        <div className="relative min-w-max">
          {currentMarkerPosition != null ? (
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-[var(--status-danger)]"
              style={{ left: `${currentMarkerPosition}px` }}
            >
              <span className="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-[var(--status-danger)]" />
            </div>
          ) : null}

          <div className="sticky top-0 z-10 flex border-b border-[var(--border)] bg-[var(--surface-subtle)]">
            <div className="sticky left-0 z-10 flex h-10 items-center border-r border-[var(--border)] bg-[var(--surface-subtle)] px-4 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]" style={{ width: LABEL_WIDTH }}>
              {isJa ? "設備" : "Equipment"}
            </div>
            {timeSlots.map((slot) => (
              <div key={slot} className="flex h-10 items-center justify-center border-r border-[var(--border)] text-xs font-semibold text-[var(--text-muted)]" style={{ width: SLOT_WIDTH }}>
                {slot}
              </div>
            ))}
          </div>

          {equipment.map((equipmentName) => {
            const plannedItems = scheduledProductsWithSlot.filter((item) => item.equipment === equipmentName);
            const actualItems = actualBlocks.filter((item) => item.equipment === equipmentName);
            const plannedUnavailable = getEquipmentAvailabilityFlag(equipmentName, scheduledProducts);
            const actualUnavailable = getEquipmentAvailabilityFlag(equipmentName, actualBlocks);
            const isBroken = isEquipmentUnavailable(equipmentName, unavailableEquipment);
            const brokenInfo = isBroken ? getEquipmentUnavailableInfo(equipmentName, unavailableEquipment) : null;

            if (hideUnavailableEquipment && (isBroken || (plannedUnavailable && actualUnavailable))) return null;

            return (
              <div key={equipmentName} className="border-b border-[var(--border)] last:border-b-0">
                <div className={`relative flex min-h-[52px] ${isBroken ? "bg-[repeating-linear-gradient(45deg,rgba(239,68,68,0.06),rgba(239,68,68,0.06)_12px,transparent_12px,transparent_24px)]" : ""} ${plannedUnavailable ? "opacity-50" : ""}`}>
                  <div className="sticky left-0 z-[5] flex flex-col justify-center border-r border-[var(--border)] bg-[var(--surface)] px-4" style={{ width: LABEL_WIDTH }}>
                    <div className="flex items-center gap-1.5">
                      <div className="text-xs font-semibold text-[var(--text-primary)]">{equipmentName}</div>
                      {isBroken ? (
                        <button
                          type="button"
                          onClick={onOpenMachineStatusModal}
                          className="rounded bg-red-100 dark:bg-red-950/80 border border-red-300 dark:border-red-800 px-1 py-0 text-[9px] font-bold text-red-700 dark:text-red-300 hover:bg-red-200 transition cursor-pointer"
                          title={brokenInfo?.reason ? `【故障】${brokenInfo.reason}` : (isJa ? "故障中" : "Broken down")}
                        >
                          {isJa ? "停止中" : "Down"}
                        </button>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.02em]">
                      {isJa
                        ? (isGroupEquipment(equipmentName) ? "計画 (グループ)" : "計画")
                        : `Planned${isGroupEquipment(equipmentName) ? " group" : " lane"}`}
                    </div>
                  </div>

                  <div className="flex">
                    {mappedSlots.map(({ slot, slotMinutes }) => {
                      const breakBlock = isBreakAtSlot(slotMinutes, equipmentName, breaks);
                      const product = getProductForSlot(slotMinutes, equipmentName, plannedItems, breaks);
                      const firstVisibleSlot = product ? product._firstSlot : null;

                      if (breakBlock) {
                        return (
                          <div
                            key={`${equipmentName}-planned-${slot}`}
                            className="border-r border-[var(--border)] bg-[var(--surface-subtle)]"
                            style={{ width: SLOT_WIDTH }}
                            title={breakBlock.name || "Break"}
                          />
                        );
                      }

                      if (product) {
                        const showLabel = firstVisibleSlot === slotMinutes;
                        return (
                          <div
                            key={`${equipmentName}-planned-${slot}`}
                            draggable={showLabel}
                            onDragStart={(event) => {
                              if (!showLabel) return;
                              event.dataTransfer.setData("application/planner-item", JSON.stringify({ scheduleId: product._scheduleId }));
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              const payload = dropPayload(event);
                              if (payload?.scheduleId) {
                                onMoveScheduledItem(payload.scheduleId, equipmentName, slot);
                              }
                            }}
                            className={`group relative border-r border-[var(--border)] ${showLabel ? "cursor-move" : "cursor-default"}`}
                            style={{ width: SLOT_WIDTH, backgroundColor: `${product.color}22` }}
                            title={`${product.背番号} · ${product.quantity} pcs`}
                          >
                            {showLabel ? (
                              <>
                                <div className="absolute inset-0 flex items-center justify-center px-1 text-xs font-bold" style={{ color: product.color }}>
                                  {product.背番号}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onRemoveScheduledItem(product)}
                                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--status-danger)] text-[9px] text-white opacity-0 shadow-sm transition group-hover:opacity-100"
                                  aria-label={`Remove ${product.背番号}`}
                                >
                                  ×
                                </button>
                              </>
                            ) : null}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={`${equipmentName}-planned-${slot}`}
                          type="button"
                          onClick={() => onSlotSelect(equipmentName, slot)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            const payload = dropPayload(event);
                            if (payload?.scheduleId) {
                              onMoveScheduledItem(payload.scheduleId, equipmentName, slot);
                            }
                          }}
                          className={`group relative border-r transition ${isBroken ? "border-red-200/50 dark:border-red-900/30 hover:bg-red-500/10 cursor-pointer" : "border-[var(--border)] hover:bg-[var(--freya-blue)]/5 cursor-pointer"}`}
                          style={{ width: SLOT_WIDTH }}
                          title={isBroken
                            ? (isJa ? `【設備停止中】${brokenInfo?.reason || "故障"} - ${equipmentName} ${slot}` : `[Machine Down] ${brokenInfo?.reason || "Broken"} - ${equipmentName} ${slot}`)
                            : `Add products at ${equipmentName} ${slot}`}
                        >
                          <span className={`material-symbols-outlined absolute inset-0 flex items-center justify-center transition ${isBroken ? "text-red-400/0 group-hover:text-red-500/80" : "text-[var(--freya-blue)]/0 group-hover:text-[var(--freya-blue)]/70"}`} style={{ fontSize: 16 }}>
                            {isBroken ? "report_problem" : "add_circle"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`flex min-h-[46px] bg-[var(--surface-subtle)]/40 ${isBroken ? "bg-[repeating-linear-gradient(45deg,rgba(239,68,68,0.03),rgba(239,68,68,0.03)_12px,transparent_12px,transparent_24px)]" : ""} ${actualUnavailable ? "opacity-50" : ""}`}>
                  <div className="sticky left-0 z-[5] flex flex-col justify-center border-r border-[var(--border)] bg-[var(--surface-subtle)] px-4" style={{ width: LABEL_WIDTH }}>
                    <div className="text-xs font-semibold text-[var(--text-primary)]">{equipmentName}</div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.02em]">
                      {isJa ? "実績" : "Actual"}
                    </div>
                  </div>

                  <div className="flex">
                    {mappedSlots.map(({ slot, slotMinutes }) => {
                      const block = getActualBlockForSlot(slotMinutes, equipmentName, actualItems);
                      const inProgress = inProgressMap?.[equipmentName]?.[slot];

                      if (block) {
                        const showLabel = slotMinutes === timeToMinutes(block.startTime);
                        const color = block.背番号 ? "#1D4ED8" : "#334155";
                        return (
                          <div
                            key={`${equipmentName}-actual-${slot}`}
                            className="relative border-r border-[var(--border)]"
                            style={{ width: SLOT_WIDTH, backgroundColor: `${color}30` }}
                            title={`${block.背番号} · ${block.totalQuantity} ${isJa ? "個 実績" : "pcs actual"}`}
                          >
                            {showLabel ? (
                              <div className="absolute inset-0 flex items-center justify-center px-1 text-xs font-semibold text-sky-900 dark:text-sky-200">
                                {block.背番号}
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      if (slotMinutes <= currentMinutes && inProgress) {
                        return (
                          <div
                            key={`${equipmentName}-actual-${slot}`}
                            className="relative border-r border-amber-400/40 bg-amber-400/15"
                            style={{ width: SLOT_WIDTH }}
                            title={`${inProgress.背番号 || inProgress.品番} ${isJa ? "進行中" : "in progress"}`}
                          >
                            <div className="absolute inset-0 flex items-center justify-center gap-1 px-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 10 }}>progress_activity</span>
                              {inProgress.背番号 || (isJa ? "稼働" : "Run")}
                            </div>
                          </div>
                        );
                      }

                      if (slotMinutes <= currentMinutes) {
                        return (
                          <div key={`${equipmentName}-actual-${slot}`} className="border-r border-[var(--border)] bg-[var(--surface-subtle)]/20" style={{ width: SLOT_WIDTH }}>
                            {slotMinutes % 60 === 0 ? <div className="mt-3.5 text-center text-[10px] font-semibold text-[var(--text-muted)]/50">{isJa ? "停止" : "IDLE"}</div> : null}
                          </div>
                        );
                      }

                      return <div key={`${equipmentName}-actual-${slot}`} className="border-r border-[var(--border)]" style={{ width: SLOT_WIDTH }} />;
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
          {isJa ? "休憩時間" : "Break time"}
        </span>
        <span className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          {isJa ? "端末ログからの進行中データ" : "In progress from tablet logs"}
        </span>
        <span className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-[var(--freya-blue)]" />
          {isJa ? "プレス生産実績" : "Actual press production"}
        </span>
      </div>
    </div>
  );
}