import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import PlannerScheduleDetailCard from "../components/planner/PlannerScheduleDetailCard";
import {
  DEFAULT_BREAKS,
  PLANNER_CONFIG,
  getScheduledSpan,
  minutesToTime,
  sortScheduledProducts,
  timeToMinutes,
} from "./planner";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function groupByEquipment(items = []) {
  return items.reduce((groups, item) => {
    const equipmentName = String(item?.equipment || "").trim() || "Unassigned";
    if (!groups[equipmentName]) groups[equipmentName] = [];
    groups[equipmentName].push(item);
    return groups;
  }, {});
}

function getWindowOrThrow(title) {
  const nextWindow = window.open("", "_blank");
  if (!nextWindow) {
    throw new Error(`Unable to open ${title}. Check if pop-ups are blocked.`);
  }
  return nextWindow;
}

function getTimelineRange(items = [], breaks = DEFAULT_BREAKS) {
  const baseStart = timeToMinutes(PLANNER_CONFIG.workStartTime);
  let rangeEnd = timeToMinutes(PLANNER_CONFIG.workEndTime);

  items.forEach((item) => {
    const span = getScheduledSpan(item, breaks);
    rangeEnd = Math.max(rangeEnd, span.endTime);
  });

  return { start: baseStart, end: rangeEnd, total: Math.max(1, rangeEnd - baseStart) };
}

function buildTimeMarkers(range) {
  const markers = [];
  for (let minute = range.start; minute <= range.end; minute += 30) {
    const position = ((minute - range.start) / range.total) * 100;
    markers.push({
      label: minutesToTime(minute),
      position,
      major: minute % 60 === 0,
    });
  }
  return markers;
}

function getSafeNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getItemCapacity(item) {
  const capacity = getSafeNumber(item?.["収容数"], 0);
  return capacity > 0 ? capacity : 0;
}

function getPcPerCycle(item) {
  const pcPerCycle = getSafeNumber(item?.pcPerCycle, PLANNER_CONFIG.defaultPcPerCycle);
  return pcPerCycle > 0 ? pcPerCycle : PLANNER_CONFIG.defaultPcPerCycle;
}

function calculateMaterialLengthMeters(item) {
  const pitch = getSafeNumber(item?.["送りピッチ"], 0);
  if (!(pitch > 0)) return null;

  const quantity = Math.max(0, getSafeNumber(item?.quantity, 0));
  const cyclesNeeded = Math.ceil(quantity / getPcPerCycle(item));
  return (cyclesNeeded * pitch) / 1000;
}

function formatMaterialLength(item) {
  const meters = calculateMaterialLengthMeters(item);
  return meters == null ? "-" : `${meters.toFixed(2)}m`;
}

function getScheduleTimeRange(item, breaks = DEFAULT_BREAKS) {
  const span = getScheduledSpan(item, breaks);
  const start = item?.startTime || minutesToTime(span.startTime);
  return `${start}-${minutesToTime(span.endTime)}`;
}

function buildScheduleDetail(item, breaks = DEFAULT_BREAKS) {
  return {
    serial: item?.背番号 || item?.品番 || "-",
    equipment: item?.equipment || "-",
    partNumber: item?.品番 || "-",
    productName: item?.品名 || "-",
    materialName: item?.["材料"] || item?.["材料名"] || "-",
    materialSerial: item?.["材料背番号"] || "-",
    capacity: getItemCapacity(item) || "-",
    timeRange: getScheduleTimeRange(item, breaks),
    quantity: Math.max(0, getSafeNumber(item?.quantity, 0)),
    boxes: Math.max(0, getSafeNumber(item?.boxes, 0)),
    note: item?.["備考"] || "-",
    imageUrl: item?.imageURL || "",
  };
}

function renderScheduleDetailHtml(item, breaks = DEFAULT_BREAKS) {
  return renderToStaticMarkup(
    createElement(PlannerScheduleDetailCard, { schedule: buildScheduleDetail(item, breaks) })
  );
}

function generateCalendarHtml({ factoryName, planDate, scheduledProducts = [], breaks = DEFAULT_BREAKS }) {
  const sortedItems = sortScheduledProducts(scheduledProducts);
  const grouped = groupByEquipment(sortedItems);
  const equipmentNames = Object.keys(grouped).sort((left, right) => left.localeCompare(right, "ja"));
  const range = getTimelineRange(sortedItems, breaks);
  const markers = buildTimeMarkers(range);
  const totalBoxes = sortedItems.reduce((sum, item) => sum + (Number(item.boxes) || 0), 0);
  const totalQuantity = sortedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const legendItems = [...new Map(sortedItems.map((item) => [item.背番号 || item.品番, item])).values()];

  const rowsHtml = equipmentNames.map((equipmentName) => {
    const items = grouped[equipmentName] || [];
    const blocksHtml = items.map((item) => {
      const span = getScheduledSpan(item, breaks);
      const left = ((span.startTime - range.start) / range.total) * 100;
      const width = Math.max(2, ((span.endTime - span.startTime) / range.total) * 100);
      const endLabel = minutesToTime(span.endTime);
      const detailTitle = encodeURIComponent(item.背番号 || item.品番 || "Schedule Detail");
      const detailHtml = encodeURIComponent(renderScheduleDetailHtml(item, breaks));
      return `
        <button
          type="button"
          class="product-block"
          data-detail-title="${detailTitle}"
          data-detail-html="${detailHtml}"
          style="left:${left}%;width:${width}%;background:${escapeHtml(item.color || "#6366f1")};"
          title="${escapeHtml(`${item.背番号 || item.品番} · ${item.quantity} pcs · ${item.boxes} boxes · ${item.startTime} - ${endLabel}`)}"
        >
          <div class="block-serial">${escapeHtml(item.背番号 || item.品番 || "-")}</div>
          <div class="block-meta">${escapeHtml(`${item.quantity} pcs · ${item.boxes} boxes`)}</div>
        </button>
      `;
    }).join("");

    return `
      <div class="equipment-row">
        <div class="equipment-label">${escapeHtml(equipmentName)}</div>
        <div class="equipment-track">${blocksHtml}</div>
      </div>
    `;
  }).join("");

  const markerHtml = markers.map((marker) => `
    <div class="time-marker ${marker.major ? "major" : ""}" style="left:${marker.position}%;">
      <span>${escapeHtml(marker.label)}</span>
    </div>
  `).join("");

  const legendHtml = legendItems.map((item) => `
    <div class="legend-item">
      <span class="legend-swatch" style="background:${escapeHtml(item.color || "#6366f1")};"></span>
      <span>${escapeHtml(item.背番号 || item.品番 || "-")}</span>
    </div>
  `).join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Planner Calendar ${escapeHtml(planDate)}</title>
        <style>
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f5f7fb;
            color: #111827;
            font-family: "DM Sans", "Yu Gothic", sans-serif;
          }
          .page {
            padding: 24px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            margin-bottom: 18px;
            padding: 20px 22px;
            border: 1px solid #d9deea;
            border-radius: 20px;
            background: rgba(255,255,255,0.92);
          }
          .eyebrow {
            font-size: 11px;
            line-height: 14px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #6b7280;
          }
          h1 {
            margin: 6px 0 0;
            font-size: 28px;
            line-height: 1.1;
          }
          .sub {
            margin-top: 8px;
            font-size: 13px;
            color: #4b5563;
          }
          .actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          .action-btn {
            border: 1px solid #cfd6e4;
            background: white;
            color: #111827;
            border-radius: 12px;
            padding: 10px 14px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 18px;
          }
          .stat {
            border: 1px solid #d9deea;
            background: white;
            border-radius: 16px;
            padding: 14px 16px;
          }
          .stat .value {
            margin-top: 8px;
            font-size: 13px;
            line-height: 16px;
            font-weight: 700;
            color: #111827;
          }
          .legend {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 18px;
            padding: 14px 16px;
            border: 1px solid #d9deea;
            border-radius: 16px;
            background: white;
          }
          .legend-item {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 700;
            color: #374151;
          }
          .legend-swatch {
            width: 12px;
            height: 12px;
            border-radius: 999px;
          }
          .calendar {
            overflow: auto;
            border: 1px solid #d9deea;
            border-radius: 20px;
            background: white;
          }
          .timeline-shell {
            min-width: 1100px;
            padding: 18px;
          }
          .timeline-header {
            position: sticky;
            top: 0;
            z-index: 5;
            display: flex;
            background: rgba(249,250,251,0.96);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid #e5e7eb;
          }
          .equipment-col {
            width: 150px;
            flex-shrink: 0;
            padding: 12px;
            border-right: 1px solid #e5e7eb;
            font-size: 10px;
            line-height: 14px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #6b7280;
          }
          .time-axis {
            position: relative;
            flex: 1;
            min-height: 44px;
          }
          .time-marker {
            position: absolute;
            top: 0;
            bottom: 0;
            border-left: 1px solid #e5e7eb;
          }
          .time-marker.major {
            border-left: 2px solid #cbd5e1;
          }
          .time-marker span {
            position: absolute;
            top: 12px;
            left: 6px;
            font-size: 10px;
            line-height: 14px;
            font-weight: 700;
            color: #4b5563;
            white-space: nowrap;
          }
          .equipment-row {
            display: flex;
            min-height: 72px;
            border-bottom: 1px solid #eef2f7;
          }
          .equipment-row:last-child {
            border-bottom: 0;
          }
          .equipment-label {
            width: 150px;
            flex-shrink: 0;
            padding: 16px 12px;
            border-right: 1px solid #e5e7eb;
            font-size: 12px;
            line-height: 16px;
            font-weight: 700;
            color: #111827;
            background: #fafbfc;
          }
          .equipment-track {
            position: relative;
            flex: 1;
            min-height: 72px;
            background-image: linear-gradient(to right, rgba(226,232,240,0.9) 1px, transparent 1px);
            background-size: calc(100% / ${(markers.length - 1) || 1}) 100%;
          }
          .product-block {
            position: absolute;
            top: 10px;
            bottom: 10px;
            border-radius: 14px;
            border: 0;
            padding: 8px 10px;
            color: white;
            overflow: hidden;
            box-shadow: 0 8px 20px rgba(15,23,42,0.14);
            cursor: pointer;
            text-align: left;
          }
          .block-serial {
            font-size: 12px;
            line-height: 16px;
            font-weight: 700;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
          }
          .block-meta {
            margin-top: 4px;
            font-size: 10px;
            line-height: 12px;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
            opacity: 0.94;
          }
          .planner-detail-modal {
            position: fixed;
            inset: 0;
            z-index: 50;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(17, 24, 39, 0.62);
            backdrop-filter: blur(6px);
          }
          .planner-detail-modal.is-open {
            display: flex;
          }
          .planner-detail-panel {
            width: min(100%, 540px);
            max-height: 90vh;
            overflow: auto;
            border-radius: 18px;
            background: white;
            box-shadow: 0 24px 80px rgba(15, 23, 42, 0.32);
          }
          .planner-detail-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 18px 20px;
            border-bottom: 1px solid #e5e7eb;
          }
          .planner-detail-title {
            margin: 0;
            font-size: 18px;
            line-height: 22px;
            font-weight: 700;
            color: #1f2937;
          }
          .planner-detail-close {
            border: 0;
            background: transparent;
            color: #6b7280;
            font-size: 28px;
            line-height: 1;
            cursor: pointer;
          }
          .planner-detail-body {
            padding: 18px 20px 20px;
          }
          .planner-schedule-detail-card {
            font-family: "DM Sans", "Yu Gothic", sans-serif;
          }
          .planner-schedule-detail-image-wrap {
            margin-bottom: 16px;
            text-align: center;
          }
          .planner-schedule-detail-image {
            display: block;
            width: 100%;
            max-height: 250px;
            object-fit: contain;
            border-radius: 10px;
            box-shadow: 0 6px 20px rgba(15, 23, 42, 0.14);
          }
          .planner-schedule-detail-grid {
            border-top: 1px solid #e5e7eb;
          }
          .planner-schedule-detail-row {
            display: grid;
            grid-template-columns: 110px minmax(0, 1fr);
            gap: 18px;
            align-items: start;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .planner-schedule-detail-label {
            font-size: 10px;
            line-height: 14px;
            font-weight: 700;
            letter-spacing: 0.08em;
            color: #6b7280;
          }
          .planner-schedule-detail-value {
            font-size: 12px;
            line-height: 18px;
            font-weight: 700;
            color: #1f2937;
            white-space: pre-wrap;
            word-break: break-word;
          }
          @media print {
            body { background: white; }
            .page { padding: 0; }
            .actions { display: none; }
            .planner-detail-modal { display: none !important; }
            .header, .legend, .calendar, .stat { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <section class="header">
            <div>
              <div class="eyebrow">Production Planning</div>
              <h1>Calendar View</h1>
              <div class="sub">${escapeHtml(factoryName || "Factory")} · ${escapeHtml(planDate || "")}</div>
            </div>
            <div class="actions">
              <button class="action-btn" onclick="window.print()">Print</button>
            </div>
          </section>

          <section class="stats">
            <div class="stat"><div class="eyebrow">Machines</div><div class="value">${equipmentNames.length}</div></div>
            <div class="stat"><div class="eyebrow">Scheduled Quantity</div><div class="value">${totalQuantity.toLocaleString()} pcs</div></div>
            <div class="stat"><div class="eyebrow">Total Boxes</div><div class="value">${totalBoxes.toLocaleString()}</div></div>
          </section>

          <section class="legend">${legendHtml}</section>

          <section class="calendar">
            <div class="timeline-shell">
              <div class="timeline-header">
                <div class="equipment-col">Equipment</div>
                <div class="time-axis">${markerHtml}</div>
              </div>
              ${rowsHtml}
            </div>
          </section>
        </div>

        <div id="plannerDetailModal" class="planner-detail-modal">
          <div class="planner-detail-panel">
            <div class="planner-detail-header">
              <h2 id="plannerDetailTitle" class="planner-detail-title">Schedule Detail</h2>
              <button type="button" class="planner-detail-close" onclick="closePlannerDetailModal()">&times;</button>
            </div>
            <div id="plannerDetailBody" class="planner-detail-body"></div>
          </div>
        </div>

        <script>
          const plannerDetailModal = document.getElementById("plannerDetailModal");
          const plannerDetailTitle = document.getElementById("plannerDetailTitle");
          const plannerDetailBody = document.getElementById("plannerDetailBody");

          function closePlannerDetailModal() {
            plannerDetailModal.classList.remove("is-open");
          }

          window.closePlannerDetailModal = closePlannerDetailModal;

          document.querySelectorAll(".product-block").forEach((block) => {
            block.addEventListener("click", () => {
              plannerDetailTitle.textContent = decodeURIComponent(block.dataset.detailTitle || "Schedule Detail");
              plannerDetailBody.innerHTML = decodeURIComponent(block.dataset.detailHtml || "");
              plannerDetailModal.classList.add("is-open");
            });
          });

          plannerDetailModal.addEventListener("click", (event) => {
            if (event.target === plannerDetailModal) {
              closePlannerDetailModal();
            }
          });

          document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              closePlannerDetailModal();
            }
          });
        </script>
      </body>
    </html>
  `;
}

function generatePrintHtml({ factoryName, planDate, scheduledProducts = [], selectedEquipment = [], breaks = DEFAULT_BREAKS }) {
  const filtered = sortScheduledProducts(scheduledProducts)
    .filter((item) => !selectedEquipment.length || selectedEquipment.includes(item.equipment));

  let currentEquipment = null;
  let groupIndex = -1;
  const sequenceMap = new Map();
  const rows = filtered.map((item) => {
    if (item.equipment !== currentEquipment) {
      currentEquipment = item.equipment;
      groupIndex += 1;
    }

    const nextSequence = (sequenceMap.get(item.equipment) || 0) + 1;
    sequenceMap.set(item.equipment, nextSequence);

    return {
      sequence: nextSequence,
      equipment: item.equipment,
      timeRange: getScheduleTimeRange(item, breaks),
      serial: item.背番号 || "-",
      materialName: item?.["材料"] || item?.["材料名"] || "-",
      materialSerial: item?.["材料背番号"] || "-",
      materialLength: formatMaterialLength(item),
      boxes: Math.max(0, getSafeNumber(item?.boxes, 0)),
      highlightGroup: groupIndex % 2 === 0,
    };
  });

  const tableRows = rows.map((row) => `
    <tr class="${row.highlightGroup ? "group-highlight" : ""}">
      <td>${row.sequence}</td>
      <td class="equipment">${escapeHtml(row.equipment)}</td>
      <td>${escapeHtml(row.timeRange)}</td>
      <td>${escapeHtml(row.serial)}</td>
      <td class="left">${escapeHtml(row.materialName)}</td>
      <td>${escapeHtml(row.materialSerial)}</td>
      <td>${escapeHtml(row.materialLength)}</td>
      <td>${row.boxes.toLocaleString()}</td>
    </tr>
  `).join("");

  const generatedAt = new Date().toLocaleString("en-US", {
    year: "2-digit",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Planner Print ${escapeHtml(planDate)}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          * { box-sizing: border-box; }
          html {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            margin: 0;
            background: white;
            color: #000;
            font-family: "MS Gothic", "Yu Gothic", sans-serif;
            padding: 0;
            font-size: 10pt;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-sheet {
            width: 100%;
          }
          .print-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8mm;
            font-size: 10pt;
          }
          .print-title {
            text-align: center;
            margin-bottom: 6mm;
            padding-bottom: 4mm;
            border-bottom: 2px solid #000;
          }
          .print-title h1 {
            margin: 0;
            font-size: 18pt;
            line-height: 1.2;
            font-weight: 700;
          }
          .print-title .date {
            margin-top: 6px;
            font-size: 14pt;
            font-weight: 700;
          }
          .actions {
            margin-top: 14px;
          }
          .actions button {
            border: 1px solid #cfd6e4;
            background: white;
            color: #111827;
            border-radius: 10px;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 9.5pt;
          }
          th, td {
            border: 1px solid #000;
            padding: 5px 4px;
            vertical-align: middle;
            text-align: center;
          }
          th {
            background-color: #f0f0f0;
            font-size: 10pt;
            line-height: 1.2;
            font-weight: 700;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          td.left {
            text-align: left;
          }
          td.sequence {
            font-weight: 700;
          }
          td.time {
            font-size: 8.75pt;
            white-space: nowrap;
          }
          td.equipment {
            font-weight: 700;
            font-size: 8.5pt;
            line-height: 1.15;
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          tr.group-highlight td {
            background-color: #e8e8e8 !important;
            box-shadow: inset 0 0 0 1000px #e8e8e8;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @media print {
            body { padding: 0; }
            .actions { display: none; }
            table, thead, tbody, tr, th, td {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            tr.group-highlight td {
              background-color: #e8e8e8 !important;
              box-shadow: inset 0 0 0 1000px #e8e8e8;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-sheet">
          <div class="print-meta">
            <span>${escapeHtml(generatedAt)}</span>
            <span>Production Schedule - ${escapeHtml(planDate || "")}</span>
          </div>

          <div class="print-title">
            <h1>生産スケジュール (Production Schedule)</h1>
            <div class="date">日付: ${escapeHtml(planDate || "")}</div>
          </div>

          <div class="actions"><button onclick="window.print()">Print</button></div>

          <table>
            <thead>
              <tr>
                <th style="width: 8%;">順番</th>
                <th style="width: 14%;">設備名</th>
                <th style="width: 18%;">時間</th>
                <th style="width: 12%;">背番号</th>
                <th style="width: 24%;">材料名</th>
                <th style="width: 12%;">材料背番号</th>
                <th style="width: 12%;">材料長さ</th>
                <th style="width: 10%;">通い箱 pcs</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}

export function openPlannerCalendarWindow({ factoryName, planDate, scheduledProducts = [], breaks = DEFAULT_BREAKS }) {
  if (!scheduledProducts.length) {
    throw new Error("No scheduled products available for calendar view.");
  }

  const nextWindow = getWindowOrThrow("calendar view");
  nextWindow.document.write(generateCalendarHtml({ factoryName, planDate, scheduledProducts, breaks }));
  nextWindow.document.close();
}

export function openPlannerPrintWindow({ factoryName, planDate, scheduledProducts = [], selectedEquipment = [], breaks = DEFAULT_BREAKS }) {
  if (!scheduledProducts.length) {
    throw new Error("No scheduled products available for printing.");
  }

  const nextWindow = getWindowOrThrow("print preview");
  nextWindow.document.write(generatePrintHtml({ factoryName, planDate, scheduledProducts, selectedEquipment, breaks }));
  nextWindow.document.close();
  nextWindow.onload = () => {
    nextWindow.focus();
    nextWindow.print();
  };
}