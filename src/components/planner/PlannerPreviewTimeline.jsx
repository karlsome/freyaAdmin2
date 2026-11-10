import { useMemo, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { PLANNER_CONFIG, isBreakAtSlot, isEquipmentUnavailable, minutesToTime, timeToMinutes } from "../../utils/planner";
import { assignmentEndMinutes, draftIdOf, getPreviewTimeSlots } from "../../utils/plannerPreviewEngine";

const SLOT_WIDTH = 42;
const LABEL_WIDTH = 120;
const LANE_HEIGHT = 56;

export default function PlannerPreviewTimeline({
  ctx,
  assignments = [],
  equipmentNames = [],
  editMode = false,
  onDrop,
  onSlotClick,
  onBlockClick,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [draggingId, setDraggingId] = useState(null);
  const [hoverKey, setHoverKey] = useState("");

  const slots = useMemo(() => getPreviewTimeSlots(ctx.scheduleUntilMinutes), [ctx.scheduleUntilMinutes]);
  const workStart = timeToMinutes(PLANNER_CONFIG.workStartTime);
  const laneWidth = slots.length * SLOT_WIDTH;

  const byEquipment = useMemo(() => {
    const map = {};
    assignments.forEach((assignment) => {
      const name = String(assignment.equipment || "").trim();
      if (!map[name]) map[name] = [];
      map[name].push(assignment);
    });
    return map;
  }, [assignments]);

  if (equipmentNames.length === 0) {
    return (
      <div className="rounded-[6px] border border-dashed border-[var(--border)] p-8 text-center text-xs text-[var(--text-muted)]">
        {isJa ? "自動割当された設備スロットはありません。" : "No machine assignment slots scheduled."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[6px] border border-[var(--border)]">
      <div style={{ width: LABEL_WIDTH + laneWidth }}>
        {/* Time header */}
        <div className="flex border-b border-[var(--border)] bg-[var(--surface-subtle)]">
          <div className="sticky left-0 z-20 shrink-0 border-r border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" style={{ width: LABEL_WIDTH }}>
            {isJa ? "設備" : "Equipment"}
          </div>
          <div className="flex" style={{ width: laneWidth }}>
            {slots.map((slot) => {
              const onHour = slot.endsWith(":00");
              return (
                <div key={slot} className="shrink-0 border-r border-[var(--border)]/60 py-1.5 text-center font-mono text-[9px] text-[var(--text-muted)]" style={{ width: SLOT_WIDTH }}>
                  {onHour || slot === slots[0] ? slot : ""}
                </div>
              );
            })}
          </div>
        </div>

        {equipmentNames.map((equipment) => {
          const items = byEquipment[equipment] || [];
          const broken = isEquipmentUnavailable(equipment, ctx.unavailableEquipment);

          return (
            <div key={equipment} className={`flex border-b border-[var(--border)] last:border-b-0 ${broken ? "bg-red-500/5" : ""}`}>
              <div className="sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r border-[var(--border)] bg-[var(--surface)] px-3" style={{ width: LABEL_WIDTH, height: LANE_HEIGHT }}>
                <span className="truncate font-mono text-xs font-semibold text-[var(--text-primary)]" title={equipment}>{equipment}</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {broken ? (isJa ? "停止中" : "Broken down") : `${items.length} ${isJa ? "件" : "jobs"}`}
                </span>
              </div>

              <div className="relative shrink-0" style={{ width: laneWidth, height: LANE_HEIGHT }}>
                {/* Background cells */}
                <div className="absolute inset-0 flex">
                  {slots.map((slot) => {
                    const minutes = timeToMinutes(slot);
                    const breakItem = isBreakAtSlot(minutes, equipment, ctx.breaks);
                    const key = `${equipment}|${slot}`;
                    const hovered = hoverKey === key;
                    return (
                      <div
                        key={slot}
                        data-slot={slot}
                        className={`group relative shrink-0 border-r border-[var(--border)]/50 transition-colors ${
                          breakItem ? "bg-slate-200/70 dark:bg-slate-700/50" : hovered ? "bg-sky-500/20" : ""
                        } ${editMode && !breakItem ? "cursor-pointer hover:bg-sky-500/10" : ""}`}
                        style={{ width: SLOT_WIDTH }}
                        title={breakItem ? breakItem.name : undefined}
                        onClick={() => { if (editMode && !breakItem && !draggingId) onSlotClick?.(equipment, slot); }}
                        onDragOver={(event) => {
                          if (!editMode || !draggingId || breakItem) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          if (hoverKey !== key) setHoverKey(key);
                        }}
                        onDragLeave={() => setHoverKey((current) => (current === key ? "" : current))}
                        onDrop={(event) => {
                          event.preventDefault();
                          setHoverKey("");
                          const id = draggingId;
                          setDraggingId(null);
                          if (editMode && id) onDrop?.(id, equipment, slot);
                        }}
                      >
                        {editMode && !breakItem ? (
                          <span className="material-symbols-outlined pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] text-sky-600 opacity-0 group-hover:opacity-60">add</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Blocks */}
                {items.map((assignment) => {
                  const start = timeToMinutes(assignment.startTime || PLANNER_CONFIG.workStartTime);
                  if (!(start < ctx.scheduleUntilMinutes)) return null;
                  const end = Math.min(assignmentEndMinutes(ctx, assignment), ctx.scheduleUntilMinutes);
                  const left = ((start - workStart) / PLANNER_CONFIG.intervalMinutes) * SLOT_WIDTH;
                  const width = Math.max(SLOT_WIDTH, ((end - start) / PLANNER_CONFIG.intervalMinutes) * SLOT_WIDTH);
                  const id = draftIdOf(assignment);
                  const isDragging = draggingId === id;

                  return (
                    <div
                      key={id}
                      draggable={editMode}
                      onDragStart={(event) => {
                        if (!editMode) return;
                        setDraggingId(id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", id);
                      }}
                      onDragEnd={() => { setDraggingId(null); setHoverKey(""); }}
                      onDragOver={(event) => {
                        if (!editMode || !draggingId || draggingId === id) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const dragged = draggingId;
                        setDraggingId(null);
                        if (editMode && dragged && dragged !== id) onDrop?.(dragged, equipment, minutesToTime(start));
                      }}
                      onClick={(event) => { event.stopPropagation(); if (editMode) onBlockClick?.(assignment); }}
                      className={`absolute top-1 bottom-1 overflow-hidden rounded-[6px] border border-white/30 px-2 py-1 text-white shadow-sm ${editMode ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-50" : ""}`}
                      style={{ left, width: width - 2, backgroundColor: assignment.color || "#0F766E" }}
                      title={`${assignment.背番号 || assignment.品番} · ${Number(assignment.quantity || 0).toLocaleString()} pcs · ${assignment.startTime}-${minutesToTime(end)}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-mono text-[11px] font-bold leading-tight">{assignment.背番号 || assignment.品番}</span>
                        {editMode ? <span className="material-symbols-outlined shrink-0 text-[12px] opacity-80">tune</span> : null}
                      </div>
                      <div className="truncate font-mono text-[9px] leading-tight opacity-90">
                        {Number(assignment.quantity || 0).toLocaleString()}{isJa ? "個" : "pcs"}
                        {assignment.boxes ? ` · ${assignment.boxes}${isJa ? "箱" : "bx"}` : ""}
                      </div>
                      {width > SLOT_WIDTH * 2 ? (
                        <div className="truncate font-mono text-[9px] leading-tight opacity-80">{assignment.requestNumberLabel || assignment.requestNumber || ""}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
