export const SCNA_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function formatDateYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDefaultFreyaTabletDates() {
  const today = new Date();
  let businessDaysCount = 0;
  const cursor = new Date(today);

  while (businessDaysCount < 7) {
    cursor.setDate(cursor.getDate() - 1);
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDaysCount += 1;
    }
  }

  return {
    dateFrom: formatDateYYYYMMDD(cursor),
    dateTo: formatDateYYYYMMDD(today),
  };
}

export function getDefaultWorkOrderDates() {
  const today = new Date();
  const from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    dateFrom: formatDateYYYYMMDD(from),
    dateTo: formatDateYYYYMMDD(to),
  };
}

export function getDefaultMachineAnalyticsDates() {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  return {
    dateFrom: formatDateYYYYMMDD(sevenDaysAgo),
    dateTo: formatDateYYYYMMDD(today),
  };
}

export function getRecordImages(record = {}) {
  const images = [];
  if (record["画像"]) {
    images.push({
      key: "firstCycle",
      label: "First Cycle Check (初物チェック画像)",
      url: record["画像"],
    });
  }
  if (record["終了時画像"]) {
    images.push({
      key: "lastCycle",
      label: "Last Cycle Check (終物チェック画像)",
      url: record["終了時画像"],
    });
  }
  if (record["材料ラベル画像"]) {
    images.push({
      key: "materialLabel",
      label: "Material Label (材料ラベル画像)",
      url: record["材料ラベル画像"],
    });
  }
  if (record["不良記録画像"]) {
    images.push({
      key: "defectRecord",
      label: "Defect Record (不良記録画像)",
      url: record["不良記録画像"],
    });
  }
  return images;
}

export function formatIndianapolisTimestamp(value) {
  if (!value) return "N/A";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("en-US", {
      timeZone: "America/Indiana/Indianapolis",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return String(value);
  }
}

export function parsePercentageValue(percentValue) {
  if (typeof percentValue === "number") return percentValue;
  if (typeof percentValue === "string") {
    const cleaned = percentValue.replace("%", "").trim();
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function getWorkOrderMaterialLoading(wo = {}) {
  return wo["Material loading %"] ?? wo["Material loading (%)"] ?? "0%";
}

export function getWorkOrderFinishedGoods(wo = {}) {
  return wo["Finished goods note %"] ?? wo["Finished goods note (%)"] ?? "0%";
}

export function formatWorkOrderDate(dateInput) {
  if (!dateInput) return "N/A";
  try {
    let date;
    if (typeof dateInput === "string") {
      if (dateInput.includes("T")) {
        date = new Date(dateInput);
      } else if (dateInput.includes("/")) {
        date = new Date(dateInput);
      } else if (dateInput.includes("-")) {
        date = new Date(`${dateInput}T00:00:00`);
      } else {
        date = new Date(dateInput);
      }
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      return "N/A";
    }

    if (Number.isNaN(date.getTime())) return String(dateInput);

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(dateInput);
  }
}

export function formatWorkOrderDateInput(dateString) {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export function getWorkOrderDeadlineMeta(wo = {}) {
  const deadline = wo["Deadline"];
  const status = wo.Status;
  if (!deadline) {
    return { formatted: "N/A", isOverdue: false, isDueSoon: false };
  }

  const deadlineDate = new Date(deadline);
  const now = new Date();
  const isValid = !Number.isNaN(deadlineDate.getTime());
  const isCompletedOrCancelled = status === "Completed" || status === "Cancelled";
  const isOverdue = isValid && deadlineDate < now && !isCompletedOrCancelled;
  const daysDiff = isValid
    ? (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  const isDueSoon = isValid && !isOverdue && daysDiff <= 3 && !isCompletedOrCancelled;

  return {
    formatted: formatWorkOrderDate(deadline),
    isOverdue,
    isDueSoon,
  };
}

export function getWorkOrderStatusBadgeClass(status) {
  switch (status) {
    case "Entered":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25";
    case "In Progress":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25";
    case "Completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
    case "Cancelled":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25";
    default:
      return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25";
  }
}

export function downloadCsvWithBom(headers, rows, filename) {
  const escapeCell = (cell) => {
    const value = cell == null ? "" : String(cell);
    return `"${value.replace(/"/g, '""')}"`;
  };

  const csvContent = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\n");

  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==================== MACHINE ANALYTICS TIMELINE HELPERS ====================

export function generateTimeSlots() {
  const slots = [];
  for (let hour = 5; hour <= 15; hour += 1) {
    const maxMinute = hour === 15 ? 15 : 45;
    for (let minute = 0; minute <= maxMinute; minute += 15) {
      const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      slots.push(timeStr);
    }
  }
  return slots;
}

export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(":").map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return null;
  }
  return parts[0] * 60 + parts[1];
}

export function generateDateList(dateFrom, dateTo) {
  const dates = [];
  if (!dateFrom || !dateTo) return dates;

  const current = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) return dates;

  while (current <= end) {
    dates.push(formatDateYYYYMMDD(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function processMachineTimelineData(records = [], dateFrom, dateTo) {
  const timeSlots = generateTimeSlots();
  const dates = generateDateList(dateFrom, dateTo);

  const recordsByDate = {};
  dates.forEach((date) => {
    recordsByDate[date] = [];
  });

  records.forEach((record) => {
    const date = record.Date;
    if (recordsByDate[date]) {
      recordsByDate[date].push(record);
    }
  });

  // 0 = Downtime, 1 = Working, 2 = Break
  const timelineMatrix = dates.map(() => new Array(timeSlots.length).fill(0));
  const recordMatrix = dates.map(() => new Array(timeSlots.length).fill(null));
  const productionPeriods = [];

  dates.forEach((date, dateIdx) => {
    const dayRecords = recordsByDate[date] || [];

    dayRecords.forEach((record) => {
      const startTime = parseTimeToMinutes(record.Time_start);
      const endTime = parseTimeToMinutes(record.Time_end);

      if (startTime !== null && endTime !== null) {
        let startSlotIdx = null;
        let endSlotIdx = null;

        timeSlots.forEach((slot, slotIdx) => {
          const slotMinutes = parseTimeToMinutes(slot);
          if (slotMinutes >= startTime && slotMinutes < endTime) {
            timelineMatrix[dateIdx][slotIdx] = 1;
            recordMatrix[dateIdx][slotIdx] = record;
            if (startSlotIdx === null) startSlotIdx = slotIdx;
            endSlotIdx = slotIdx;
          }
        });

        if (startSlotIdx !== null && endSlotIdx !== null) {
          const centerSlotIdx = Math.floor((startSlotIdx + endSlotIdx) / 2);
          productionPeriods.push({
            dateIndex: dateIdx,
            startSlotIndex: startSlotIdx,
            endSlotIndex: endSlotIdx,
            centerSlotIndex: centerSlotIdx,
            partNumber: record["品番"] || "N/A",
            total: record.Total || record.Process_Quantity || 0,
            worker: record.Worker_Name || "N/A",
            timeStart: record.Time_start,
            timeEnd: record.Time_end,
            record,
          });
        }
      }

      if (record.Break_Time_Data && Array.isArray(record.Break_Time_Data.breakSessions)) {
        record.Break_Time_Data.breakSessions.forEach((breakSession) => {
          const breakStart = parseTimeToMinutes(breakSession.startTime);
          const breakEnd = parseTimeToMinutes(breakSession.endTime);

          if (breakStart !== null && breakEnd !== null) {
            timeSlots.forEach((slot, slotIdx) => {
              const slotMinutes = parseTimeToMinutes(slot);
              if (slotMinutes >= breakStart && slotMinutes < breakEnd) {
                timelineMatrix[dateIdx][slotIdx] = 2;
                recordMatrix[dateIdx][slotIdx] = record;
              }
            });
          }
        });
      }
    });
  });

  return {
    dates,
    timeSlots,
    timelineMatrix,
    recordMatrix,
    productionPeriods,
  };
}

// ==================== CUSTOM CSV EXPORT COLUMNS & TEMPLATES ====================

export const SCNA_MACHINE_EXPORT_COLUMNS = [
  { key: "Date", label: "Date (日付)", category: "basic", defaultOrder: 1 },
  { key: "設備", label: "Machine (設備)", category: "basic", defaultOrder: 2 },
  { key: "Worker_Name", label: "Worker Name (作業者名)", category: "basic", defaultOrder: 3 },
  { key: "工場", label: "Factory (工場)", category: "basic", defaultOrder: null },

  { key: "品番", label: "Part Number (品番)", category: "production", defaultOrder: 4 },
  { key: "背番号", label: "Back Number (背番号)", category: "production", defaultOrder: 5 },
  { key: "WorkOrder_No", label: "Work Order No", category: "production", defaultOrder: 6 },
  { key: "Product_Name", label: "Product Name", category: "production", defaultOrder: null },
  { key: "Total", label: "Total Good (良品数)", category: "production", defaultOrder: 9 },
  { key: "Process_Quantity", label: "Process Quantity (加工数)", category: "production", defaultOrder: 10 },
  { key: "Remaining_WorkOrder", label: "Remaining Work Order", category: "production", defaultOrder: null },
  { key: "Required_Quantity", label: "Required Quantity", category: "production", defaultOrder: null },

  { key: "Total_NG", label: "Total NG (不良合計)", category: "quality", defaultOrder: null },
  { key: "疵引不良", label: "Non Conforming Supplier (疵引不良)", category: "quality", defaultOrder: null },
  { key: "加工不良", label: "Non Conforming Internal (加工不良)", category: "quality", defaultOrder: null },
  { key: "その他", label: "Other NG (その他)", category: "quality", defaultOrder: null },
  { key: "疵引処理数", label: "Scratch Processed Qty (疵引処理数)", category: "quality", defaultOrder: null },
  { key: "Quality_Check_Count", label: "Quality Checks Count", category: "quality", defaultOrder: null },

  { key: "Time_start", label: "Start Time (開始時刻)", category: "timing", defaultOrder: 7 },
  { key: "Time_end", label: "End Time (終了時刻)", category: "timing", defaultOrder: 8 },
  { key: "Cycle_Time", label: "Cycle Time (s) (サイクルタイム)", category: "timing", defaultOrder: null },
  { key: "Total_Break_Minutes", label: "Break Time (min) (休憩時間・分)", category: "timing", defaultOrder: null },
  { key: "Total_Break_Hours", label: "Break Time (hrs) (休憩時間・時)", category: "timing", defaultOrder: null },

  { key: "WorkOrder_Assigned_Machine", label: "Assigned Machine", category: "workorder", defaultOrder: null },

  { key: "製造ロット", label: "Lot Number (製造ロット)", category: "additional", defaultOrder: null },
  { key: "材料ロット", label: "Material Lot (材料ロット)", category: "additional", defaultOrder: null },
  { key: "Comment", label: "Comment (コメント)", category: "additional", defaultOrder: null },
];

export const SCNA_MACHINE_EXPORT_CATEGORIES = [
  { key: "basic", title: "📋 Basic Information", titleJa: "📋 基本情報" },
  { key: "production", title: "🏭 Production Details", titleJa: "🏭 生産詳細" },
  { key: "quality", title: "✅ Quality & NG Data", titleJa: "✅ 品質・不良データ" },
  { key: "timing", title: "⏱️ Timing & Breaks", titleJa: "⏱️ 時間・休憩" },
  { key: "workorder", title: "📦 Work Order Info", titleJa: "📦 ワークオーダー情報" },
  { key: "additional", title: "📝 Additional Info", titleJa: "📝 追加情報" },
];

export const SCNA_DEFAULT_EXPORT_TEMPLATES = {
  default: {
    name: "Default Template",
    columns: [
      { key: "Date", order: 1 },
      { key: "設備", order: 2 },
      { key: "Worker_Name", order: 3 },
      { key: "品番", order: 4 },
      { key: "背番号", order: 5 },
      { key: "WorkOrder_No", order: 6 },
      { key: "Time_start", order: 7 },
      { key: "Time_end", order: 8 },
      { key: "Total", order: 9 },
      { key: "Process_Quantity", order: 10 },
    ],
  },
  detailed: {
    name: "Detailed Production Report",
    columns: [
      { key: "Date", order: 1 },
      { key: "設備", order: 2 },
      { key: "Worker_Name", order: 3 },
      { key: "品番", order: 4 },
      { key: "背番号", order: 5 },
      { key: "WorkOrder_No", order: 6 },
      { key: "Product_Name", order: 7 },
      { key: "Time_start", order: 8 },
      { key: "Time_end", order: 9 },
      { key: "Process_Quantity", order: 10 },
      { key: "Total", order: 11 },
      { key: "Total_NG", order: 12 },
      { key: "Cycle_Time", order: 13 },
      { key: "Total_Break_Minutes", order: 14 },
      { key: "製造ロット", order: 15 },
      { key: "Comment", order: 16 },
    ],
  },
};

export function extractMachineExportValue(record = {}, columnKey) {
  switch (columnKey) {
    case "WorkOrder_No":
      return record.WorkOrder_Info?.workOrderNumber || "";
    case "Product_Name":
      return record.WorkOrder_Info?.productName || "";
    case "Required_Quantity":
      return record.WorkOrder_Info?.requiredQuantity || "";
    case "WorkOrder_Assigned_Machine":
      return record.WorkOrder_Info?.assignedMachine || "";
    case "Total_Break_Minutes":
      return record.Break_Time_Data?.totalBreakMinutes || 0;
    case "Total_Break_Hours":
      return record.Break_Time_Data?.totalBreakHours || 0;
    case "Quality_Check_Count":
      return record.Quality_Check_Data?.totalChecks || 0;
    case "Cycle_Time":
      return record.Cycle_Time ? Number(record.Cycle_Time).toFixed(2) : "";
    default:
      return record[columnKey] !== undefined && record[columnKey] !== null
        ? record[columnKey]
        : "";
  }
}

