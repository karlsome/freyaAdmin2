import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { parseTimeToMinutes, processMachineTimelineData } from "../../utils/scna";

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const ScnaMachineTimelineChart = forwardRef(function ScnaMachineTimelineChart(
  { records = [], dateFrom, dateTo, onSelectRecord },
  ref
) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1100);
  const [hoverInfo, setHoverInfo] = useState(null);

  const timelineData = useMemo(
    () => processMachineTimelineData(records, dateFrom, dateTo),
    [records, dateFrom, dateTo]
  );

  const { dates, timeSlots, timelineMatrix, recordMatrix, productionPeriods } =
    timelineData;

  const rowHeight = 52;
  const padLeft = 104;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 64;
  const chartHeight = Math.max(260, dates.length * rowHeight + padTop + padBottom);
  const drawWidth = Math.max(920, containerWidth);

  useImperativeHandle(ref, () => ({
    getDataURL: () => {
      if (!canvasRef.current) return null;
      return canvasRef.current.toDataURL("image/png", 1.0);
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dates.length || !timeSlots.length) return;

    const dpr = Math.max(2, window.devicePixelRatio || 2);
    canvas.width = drawWidth * dpr;
    canvas.height = chartHeight * dpr;

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear with white background so both canvas and PDF export are clean
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, drawWidth, chartHeight);

    const gridWidth = drawWidth - padLeft - padRight;
    const gridHeight = dates.length * rowHeight;
    const cellWidth = gridWidth / timeSlots.length;
    const cellHeight = rowHeight;

    // 1. Draw cells (Note: ECharts Y-axis puts index 0 at bottom or top; let's render dates top-to-bottom in chronological order with clear Y labels)
    dates.forEach((date, dateIdx) => {
      const y = padTop + dateIdx * cellHeight;

      // Y-axis Date Label
      ctx.fillStyle = "#334155";
      ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(date, padLeft - 10, y + cellHeight / 2);

      timeSlots.forEach((slot, slotIdx) => {
        const x = padLeft + slotIdx * cellWidth;
        const status = timelineMatrix[dateIdx]?.[slotIdx] ?? 0;

        if (status === 1) {
          ctx.fillStyle = "#3B82F6"; // Working (Blue)
        } else if (status === 2) {
          ctx.fillStyle = "#EF4444"; // Break (Red)
        } else {
          ctx.fillStyle = "#6B7280"; // Downtime (Gray)
        }

        ctx.fillRect(x, y, cellWidth, cellHeight);

        // Cell border
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellWidth, cellHeight);
      });
    });

    // 2. Draw X-axis Time Labels (rotated 45 deg)
    ctx.fillStyle = "#334155";
    ctx.font = "500 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    timeSlots.forEach((slot, slotIdx) => {
      const x = padLeft + slotIdx * cellWidth + cellWidth / 2;
      const y = padTop + gridHeight + 10;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(slot, 0, 0);
      ctx.restore();
    });

    // 3. Draw Centered White Pill Labels for each Production Period
    productionPeriods.forEach((period) => {
      const centerX =
        padLeft + period.centerSlotIndex * cellWidth + cellWidth / 2;
      const centerY = padTop + period.dateIndex * cellHeight + cellHeight / 2;

      const line1 = String(period.partNumber || "N/A");
      const line2 = `Total: ${period.total}`;

      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      const w1 = ctx.measureText(line1).width;
      ctx.font = "600 9px Inter, system-ui, sans-serif";
      const w2 = ctx.measureText(line2).width;

      const boxWidth = Math.max(w1, w2) + 12;
      const boxHeight = 28;
      const boxX = centerX - boxWidth / 2;
      const boxY = centerY - boxHeight / 2;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;

      drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = "#1e40af";
      ctx.stroke();

      ctx.fillStyle = "#1e3a8a";
      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(line1, centerX, centerY - 5);

      ctx.fillStyle = "#1e40af";
      ctx.font = "600 9px Inter, system-ui, sans-serif";
      ctx.fillText(line2, centerX, centerY + 6.5);
      ctx.restore();
    });

    ctx.restore();
  }, [
    chartHeight,
    dates,
    drawWidth,
    productionPeriods,
    timeSlots,
    timelineMatrix,
  ]);

  function resolveCellFromMouseEvent(event) {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = drawWidth / rect.width;
    const scaleY = chartHeight / rect.height;

    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    const gridWidth = drawWidth - padLeft - padRight;
    const gridHeight = dates.length * rowHeight;

    if (
      mouseX < padLeft ||
      mouseX >= padLeft + gridWidth ||
      mouseY < padTop ||
      mouseY >= padTop + gridHeight
    ) {
      return null;
    }

    const cellWidth = gridWidth / timeSlots.length;
    const slotIdx = Math.floor((mouseX - padLeft) / cellWidth);
    const dateIdx = Math.floor((mouseY - padTop) / rowHeight);

    if (
      slotIdx < 0 ||
      slotIdx >= timeSlots.length ||
      dateIdx < 0 ||
      dateIdx >= dates.length
    ) {
      return null;
    }

    const status = timelineMatrix[dateIdx]?.[slotIdx] ?? 0;
    const record = recordMatrix[dateIdx]?.[slotIdx] || null;
    const timeSlot = timeSlots[slotIdx];
    const nextSlot = timeSlots[slotIdx + 1] || "15:30";
    const date = dates[dateIdx];

    let matchingBreakSession = null;
    if (status === 2 && record?.Break_Time_Data?.breakSessions) {
      const slotMinutes = parseTimeToMinutes(timeSlot);
      matchingBreakSession =
        record.Break_Time_Data.breakSessions.find((bs) => {
          const bsStart = parseTimeToMinutes(bs.startTime);
          const bsEnd = parseTimeToMinutes(bs.endTime);
          return (
            bsStart !== null &&
            bsEnd !== null &&
            slotMinutes >= bsStart &&
            slotMinutes < bsEnd
          );
        }) || null;
    }

    return {
      slotIdx,
      dateIdx,
      status,
      record,
      timeSlot,
      nextSlot,
      date,
      matchingBreakSession,
      clientX: event.clientX - rect.left,
      clientY: event.clientY - rect.top,
      containerWidth: rect.width,
    };
  }

  function handleMouseMove(event) {
    const cell = resolveCellFromMouseEvent(event);
    setHoverInfo(cell);
  }

  function handleClick(event) {
    const cell = resolveCellFromMouseEvent(event);
    if (cell?.record) {
      onSelectRecord?.(cell.record);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full overflow-x-auto">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverInfo(null)}
        onClick={handleClick}
        style={{
          width: `${drawWidth}px`,
          height: `${chartHeight}px`,
          cursor: hoverInfo?.record ? "pointer" : "default",
        }}
        className="block rounded-[6px] border border-[var(--border)] bg-white"
      />

      {/* Interactive Tooltip matching scnaMachineAnalytics.js */}
      {hoverInfo && (
        <div
          className="pointer-events-none absolute z-30 w-64 rounded-[8px] border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-xs shadow-xl"
          style={{
            left: `${Math.min(
              Math.max(8, hoverInfo.clientX + 14),
              Math.max(8, (hoverInfo.containerWidth || drawWidth) - 270)
            )}px`,
            top: `${Math.max(8, hoverInfo.clientY - 12)}px`,
          }}
        >
          <div className="font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-xs"
              style={{
                backgroundColor:
                  hoverInfo.status === 1
                    ? "#3B82F6"
                    : hoverInfo.status === 2
                      ? "#EF4444"
                      : "#6B7280",
              }}
            />
            <span>
              Status:{" "}
              {hoverInfo.status === 1
                ? "Production"
                : hoverInfo.status === 2
                  ? "Break Time"
                  : "Downtime"}
            </span>
          </div>
          <div className="text-[11px] font-mono text-[var(--text-secondary)]">
            Time: {hoverInfo.timeSlot} - {hoverInfo.nextSlot}
          </div>
          <div className="text-[11px] font-mono text-[var(--text-secondary)]">
            Date: {hoverInfo.date}
          </div>

          {hoverInfo.status === 1 && hoverInfo.record && (
            <div className="mt-2 pt-2 border-t border-[var(--border)] space-y-0.5 text-[11px]">
              <div>
                <strong className="text-[var(--text-muted)]">Part Number:</strong>{" "}
                <span className="font-mono font-semibold text-[var(--text-primary)]">
                  {hoverInfo.record["品番"] || "N/A"}
                </span>
              </div>
              <div>
                <strong className="text-[var(--text-muted)]">Back Number:</strong>{" "}
                <span className="font-mono text-[var(--text-primary)]">
                  {hoverInfo.record["背番号"] || "N/A"}
                </span>
              </div>
              <div>
                <strong className="text-[var(--text-muted)]">Worker:</strong>{" "}
                <span className="text-[var(--text-primary)]">
                  {hoverInfo.record.Worker_Name || "N/A"}
                </span>
              </div>
              <div>
                <strong className="text-[var(--text-muted)]">Session Time:</strong>{" "}
                <span className="font-mono text-[var(--text-primary)]">
                  {hoverInfo.record.Time_start || "N/A"} -{" "}
                  {hoverInfo.record.Time_end || "N/A"}
                </span>
              </div>
              <div>
                <strong className="text-[var(--text-muted)]">Total Quantity:</strong>{" "}
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {hoverInfo.record.Total || 0}
                </span>
              </div>
              <div>
                <strong className="text-[var(--text-muted)]">Process Quantity:</strong>{" "}
                <span className="font-mono text-[var(--text-primary)]">
                  {hoverInfo.record.Process_Quantity || 0}
                </span>
              </div>
              <div>
                <strong className="text-[var(--text-muted)]">Total NG:</strong>{" "}
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {hoverInfo.record.Total_NG || 0}
                </span>
              </div>
              <div>
                <strong className="text-[var(--text-muted)]">Cycle Time:</strong>{" "}
                <span className="font-mono text-[var(--text-primary)]">
                  {hoverInfo.record.Cycle_Time
                    ? `${Number(hoverInfo.record.Cycle_Time).toFixed(2)}s`
                    : "0s"}
                </span>
              </div>
              {hoverInfo.record.WorkOrder_Info?.workOrderNumber && (
                <div>
                  <strong className="text-[var(--text-muted)]">Work Order:</strong>{" "}
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {hoverInfo.record.WorkOrder_Info.workOrderNumber}
                  </span>
                </div>
              )}
              <div className="pt-1 text-[10px] italic text-blue-600 dark:text-blue-400">
                Click for full details
              </div>
            </div>
          )}

          {hoverInfo.status === 2 && hoverInfo.record && (
            <div className="mt-2 pt-2 border-t border-[var(--border)] space-y-0.5 text-[11px]">
              {hoverInfo.matchingBreakSession && (
                <div>
                  <strong className="text-[var(--text-muted)]">Break Session:</strong>{" "}
                  <span className="font-mono text-[var(--text-primary)]">
                    {hoverInfo.matchingBreakSession.startTime} -{" "}
                    {hoverInfo.matchingBreakSession.endTime} (
                    {hoverInfo.matchingBreakSession.durationMinutes} min)
                  </span>
                </div>
              )}
              <div>
                <strong className="text-[var(--text-muted)]">Part Number:</strong>{" "}
                <span className="font-mono text-[var(--text-primary)]">
                  {hoverInfo.record["品番"] || "N/A"}
                </span>
              </div>
              <div>
                <strong className="text-[var(--text-muted)]">Worker:</strong>{" "}
                <span className="text-[var(--text-primary)]">
                  {hoverInfo.record.Worker_Name || "N/A"}
                </span>
              </div>
              <div className="pt-1 text-[10px] italic text-blue-600 dark:text-blue-400">
                Click for production details
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ScnaMachineTimelineChart;

