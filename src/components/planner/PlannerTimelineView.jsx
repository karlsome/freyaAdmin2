import {
  equipmentConflicts,
  getFirstVisibleSlotMinutes,
  getProductForSlot,
  getTimelineSlots,
  isBreakAtSlot,
  isGroupEquipment,
  minutesToTime,
  timeToMinutes,
} from "../../utils/planner";

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
  hideUnavailableEquipment = false,
  onToggleHideUnavailable,
  onSlotSelect,
  onMoveScheduledItem,
  onRemoveScheduledItem,
}) {
  const timeSlots = getTimelineSlots(scheduledProducts, actualBlocks, breaks);
  const now = new Date();
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  const timelineStart = timeToMinutes(timeSlots[0] || "08:45");
  const currentMarkerPosition = currentMinutes >= timelineStart
    ? (((currentMinutes - timelineStart) / 15) * SLOT_WIDTH) + LABEL_WIDTH
    : null;

  if (!equipment.length) {
    return (
      <div className="rounded-3xl border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-14 text-center text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl text-primary/60">calendar_month</span>
        <p className="mt-3 text-lg font-semibold text-on-surface">No equipment loaded</p>
        <p className="mt-1 text-sm">Choose a factory to build the planning timeline.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-on-surface">Timeline View</h3>
          <p className="mt-1 text-sm text-on-surface-variant">Place products on equipment rows and compare planned output against actual production.</p>
        </div>

        <button
          type="button"
          onClick={onToggleHideUnavailable}
          className={`rounded-2xl border px-4 py-2 text-xs font-semibold transition ${hideUnavailableEquipment ? "border-primary/25 bg-primary/10 text-primary" : "border-outline-variant/20 bg-surface-container text-on-surface"}`}
        >
          {hideUnavailableEquipment ? "Show unavailable equipment" : "Hide unavailable equipment"}
        </button>
      </div>

      <div className="overflow-auto rounded-3xl border border-outline-variant/15 bg-surface-container-low">
        <div className="relative min-w-max">
          {currentMarkerPosition != null ? (
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-error"
              style={{ left: `${currentMarkerPosition}px` }}
            >
              <span className="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-error" />
            </div>
          ) : null}

          <div className="sticky top-0 z-10 flex border-b border-outline-variant/15 bg-surface-container-high/95 backdrop-blur-md">
            <div className="planner-data-label sticky left-0 z-10 flex h-12 items-center border-r border-outline-variant/15 bg-surface-container-high/95 px-4 text-outline" style={{ width: LABEL_WIDTH }}>
              Equipment
            </div>
            {timeSlots.map((slot) => (
              <div key={slot} className="planner-data-text flex h-12 items-center justify-center border-r border-outline-variant/10 font-semibold text-on-surface-variant" style={{ width: SLOT_WIDTH }}>
                {slot}
              </div>
            ))}
          </div>

          {equipment.map((equipmentName) => {
            const plannedItems = scheduledProducts.filter((item) => item.equipment === equipmentName);
            const actualItems = actualBlocks.filter((item) => item.equipment === equipmentName);
            const plannedUnavailable = getEquipmentAvailabilityFlag(equipmentName, scheduledProducts);
            const actualUnavailable = getEquipmentAvailabilityFlag(equipmentName, actualBlocks);

            if (hideUnavailableEquipment && plannedUnavailable && actualUnavailable) return null;

            return (
              <div key={equipmentName} className="border-b border-outline-variant/10 last:border-b-0">
                <div className={`flex min-h-[58px] ${plannedUnavailable ? "opacity-50" : ""}`}>
                  <div className="sticky left-0 z-[5] flex flex-col justify-center border-r border-outline-variant/15 bg-surface px-4" style={{ width: LABEL_WIDTH }}>
                    <div className="planner-data-text font-semibold text-on-surface">{equipmentName}</div>
                    <div className="planner-data-label text-outline">
                      Planned{isGroupEquipment(equipmentName) ? " group" : " lane"}
                    </div>
                  </div>

                  <div className="flex">
                    {timeSlots.map((slot) => {
                      const slotMinutes = timeToMinutes(slot);
                      const breakBlock = isBreakAtSlot(slotMinutes, equipmentName, breaks);
                      const product = getProductForSlot(slotMinutes, equipmentName, plannedItems, breaks);
                      const firstVisibleSlot = product ? getFirstVisibleSlotMinutes(product, breaks) : null;

                      if (breakBlock) {
                        return (
                          <div
                            key={`${equipmentName}-planned-${slot}`}
                            className="border-r border-outline-variant/10 bg-surface-container-high"
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
                            className={`group relative border-r border-outline-variant/10 ${showLabel ? "cursor-move" : "cursor-default"}`}
                            style={{ width: SLOT_WIDTH, backgroundColor: `${product.color}22` }}
                            title={`${product.背番号} · ${product.quantity} pcs`}
                          >
                            {showLabel ? (
                              <>
                                <div className="planner-data-text absolute inset-0 flex items-center justify-center px-1 font-semibold" style={{ color: product.color }}>
                                  {product.背番号}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onRemoveScheduledItem(product)}
                                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-error text-[10px] text-white opacity-0 shadow-md transition group-hover:opacity-100"
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
                          className="group relative border-r border-outline-variant/10 transition hover:bg-primary/5"
                          style={{ width: SLOT_WIDTH }}
                          title={`Add products at ${equipmentName} ${slot}`}
                        >
                          <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-primary/0 transition group-hover:text-primary/70" style={{ fontSize: 16 }}>
                            add_circle
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`flex min-h-[50px] bg-surface-container-lowest/30 ${actualUnavailable ? "opacity-50" : ""}`}>
                  <div className="sticky left-0 z-[5] flex flex-col justify-center border-r border-outline-variant/15 bg-surface-container-low px-4" style={{ width: LABEL_WIDTH }}>
                    <div className="planner-data-text font-semibold text-on-surface">{equipmentName}</div>
                    <div className="planner-data-label text-outline">Actual</div>
                  </div>

                  <div className="flex">
                    {timeSlots.map((slot) => {
                      const slotMinutes = timeToMinutes(slot);
                      const block = getActualBlockForSlot(slotMinutes, equipmentName, actualItems);
                      const inProgress = inProgressMap?.[equipmentName]?.[slot];

                      if (block) {
                        const showLabel = slotMinutes === timeToMinutes(block.startTime);
                        const color = block.背番号 ? "#1D4ED8" : "#334155";
                        return (
                          <div
                            key={`${equipmentName}-actual-${slot}`}
                            className="relative border-r border-outline-variant/10"
                            style={{ width: SLOT_WIDTH, backgroundColor: `${color}30` }}
                            title={`${block.背番号} · ${block.totalQuantity} pcs actual`}
                          >
                            {showLabel ? (
                              <div className="planner-data-text absolute inset-0 flex items-center justify-center px-1 font-semibold text-sky-900 dark:text-sky-200">
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
                            className="relative border-r border-amber-300/50 bg-amber-300/20"
                            style={{ width: SLOT_WIDTH }}
                            title={`${inProgress.背番号 || inProgress.品番} in progress`}
                          >
                            <div className="planner-data-text absolute inset-0 flex items-center justify-center gap-1 px-1 font-semibold text-amber-700 dark:text-amber-300">
                              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 10 }}>progress_activity</span>
                              {inProgress.背番号 || "Run"}
                            </div>
                          </div>
                        );
                      }

                      if (slotMinutes <= currentMinutes) {
                        return (
                          <div key={`${equipmentName}-actual-${slot}`} className="border-r border-outline-variant/10 bg-[#16181e]" style={{ width: SLOT_WIDTH }}>
                            {slotMinutes % 60 === 0 ? <div className="planner-data-text mt-4 text-center font-semibold text-white/40">IDLE</div> : null}
                          </div>
                        );
                      }

                      return <div key={`${equipmentName}-actual-${slot}`} className="border-r border-outline-variant/10" style={{ width: SLOT_WIDTH }} />;
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-surface-container-highest" />
          Break time
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          In progress from tablet logs
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-700" />
          Actual press production
        </span>
      </div>
    </div>
  );
}