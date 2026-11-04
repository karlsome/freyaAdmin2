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

  if (Array.isArray(record.materialLabelImages)) {
    record.materialLabelImages.forEach((url, index) => {
      if (typeof url === "string" && url.trim()) {
        images.push({
          key: `materialLabelImages[${index}]`,
          label: `Material Label ${index + 1}`,
          labelJa: `材料ラベル ${index + 1} (Material Label ${index + 1})`,
          url,
        });
      }
    });
  }

  const firstArticleUrl = record["初物チェック画像"] || record["画像"];
  if (typeof firstArticleUrl === "string" && firstArticleUrl.trim()) {
    images.push({
      key: "firstArticleCheck",
      label: "First Article Check Image",
      labelJa: "初物チェック画像 (First Article Check Image)",
      url: firstArticleUrl,
    });
  }

  const finalArticleUrl = record["終物チェック画像"] || record["終了時画像"];
  if (typeof finalArticleUrl === "string" && finalArticleUrl.trim()) {
    images.push({
      key: "finalArticleCheck",
      label: "Final Article Check Image",
      labelJa: "終物チェック画像 (Final Article Check Image)",
      url: finalArticleUrl,
    });
  }

  if (typeof record["材料ラベル画像"] === "string" && record["材料ラベル画像"].trim()) {
    images.push({
      key: "materialLabelImage",
      label: "Material Label Image",
      labelJa: "材料ラベル画像 (Material Label Image)",
      url: record["材料ラベル画像"],
    });
  }

  if (typeof record["不良記録画像"] === "string" && record["不良記録画像"].trim()) {
    images.push({
      key: "defectRecord",
      label: "Defect Record Image",
      labelJa: "不良記録画像 (Defect Record Image)",
      url: record["不良記録画像"],
    });
  }

  // Any other Firebase Storage URL fields (legacy getImageCount counted these too)
  const knownUrls = new Set(images.map((img) => img.url));
  Object.keys(record).forEach((key) => {
    const value = record[key];
    if (
      typeof value === "string" &&
      value.includes("firebasestorage.googleapis.com") &&
      !knownUrls.has(value)
    ) {
      knownUrls.add(value);
      images.push({ key: `extra:${key}`, label: key, labelJa: key, url: value });
    }
  });

  return images;
}

export function formatIndianapolisTimestamp(value, includeSeconds = false) {
  if (!value) return "N/A";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const options = {
      timeZone: "America/Indiana/Indianapolis",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    };
    if (includeSeconds) {
      options.second = "2-digit";
    }
    return d.toLocaleString("en-US", options);
  } catch {
    return String(value);
  }
}

export function getRecordBreakData(record = {}) {
  const breakDataObj = record.Break_Time_Data;
  const entries = [];

  if (breakDataObj && typeof breakDataObj === "object") {
    Object.keys(breakDataObj).forEach((breakKey) => {
      if (breakKey === "breakSessions" || breakKey === "totalBreakMinutes" || breakKey === "totalBreakHours") {
        return;
      }
      const item = breakDataObj[breakKey];
      if (item && typeof item === "object" && (item.start || item.end || item.startTime || item.endTime)) {
        const start = item.start || item.startTime || "";
        const end = item.end || item.endTime || "";
        entries.push({
          key: breakKey,
          label: breakKey.toUpperCase(),
          start: start || "N/A",
          end: end || "N/A",
          durationMinutes: item.durationMinutes ?? null,
          timestamp: item.timestamp ?? null,
        });
      }
    });

    if (entries.length === 0 && Array.isArray(breakDataObj.breakSessions)) {
      breakDataObj.breakSessions.forEach((session, idx) => {
        if (!session) return;
        const start = session.start || session.startTime || "";
        const end = session.end || session.endTime || "";
        if (start || end) {
          entries.push({
            key: `break${idx + 1}`,
            label: `BREAK${idx + 1}`,
            start: start || "N/A",
            end: end || "N/A",
            durationMinutes: session.durationMinutes ?? null,
            timestamp: session.timestamp ?? null,
          });
        }
      });
    }
  }

  const totalBreakMinutes =
    record.Total_Break_Minutes ?? breakDataObj?.totalBreakMinutes ?? 0;
  const totalBreakHours =
    record.Total_Break_Hours ?? breakDataObj?.totalBreakHours ?? 0;

  return {
    hasBreakData: Boolean(
      breakDataObj ||
        record.Total_Break_Minutes !== undefined ||
        record.Total_Break_Hours !== undefined
    ),
    entries,
    totalBreakMinutes,
    totalBreakHours,
  };
}

export function getRecordQualityChecks(record = {}) {
  const twoHourQc = record["2HourQualityCheck"];
  if (twoHourQc && typeof twoHourQc === "object" && twoHourQc.checks) {
    const checksObj = twoHourQc.checks;
    const checks = Object.keys(checksObj)
      .map((checkKey) => {
        const check = checksObj[checkKey];
        if (!check || typeof check !== "object") return null;

        let displayTime = "N/A";
        if (check.timestamp) {
          const formatted = formatIndianapolisTimestamp(check.timestamp, false);
          displayTime = formatted !== "N/A" ? formatted : check.checkTime || "N/A";
        } else if (check.checkTime) {
          displayTime = check.checkTime;
        }

        return {
          key: checkKey,
          checkNumber: check.checkNumber || checkKey,
          checkerName: check.checkerName || check.checker || "N/A",
          displayTime,
          raw: check,
        };
      })
      .filter(Boolean);

    return {
      hasQualityChecks: true,
      totalChecks: twoHourQc.totalChecks ?? checks.length ?? 0,
      checks,
    };
  }

  // Fallback for Quality_Check_Data structure if present
  const fallbackQc = record.Quality_Check_Data;
  if (fallbackQc && typeof fallbackQc === "object") {
    const sessions = Array.isArray(fallbackQc.checkSessions)
      ? fallbackQc.checkSessions
      : [];
    const checks = sessions.map((session, idx) => ({
      key: `check_${idx + 1}`,
      checkNumber: session.checkNumber || idx + 1,
      checkerName: session.checkerName || session.checker || "N/A",
      displayTime: formatIndianapolisTimestamp(
        session.timestamp || session.completedTimestamp || session.scheduledTimestamp,
        false
      ),
      raw: session,
    }));

    return {
      hasQualityChecks: true,
      totalChecks: fallbackQc.totalChecks ?? checks.length ?? 0,
      checks,
    };
  }

  return {
    hasQualityChecks: false,
    totalChecks: 0,
    checks: [],
  };
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

function formatPercentField(raw) {
  if (raw === null || raw === undefined || raw === "") return "0%";
  const str = String(raw).trim();
  return str.endsWith("%") ? str : `${str}%`;
}

// SCNAWorkOrderDB stores these as numbers under the "(%)" keys.
// The "%" keys are a fallback for documents edited by an earlier build.
export function getWorkOrderMaterialLoading(wo = {}) {
  return formatPercentField(wo["Material loading (%)"] ?? wo["Material loading %"]);
}

export function getWorkOrderFinishedGoods(wo = {}) {
  return formatPercentField(wo["Finished goods note (%)"] ?? wo["Finished goods note %"]);
}

export function formatWorkOrderDateTime(dateInput) {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

      const breakInfo = getRecordBreakData(record);
      if (breakInfo.entries.length > 0) {
        breakInfo.entries.forEach((breakEntry) => {
          const breakStart = parseTimeToMinutes(breakEntry.start);
          const breakEnd = parseTimeToMinutes(breakEntry.end);

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
  { key: "Product_Name", label: "SKU / Product Name", category: "production", defaultOrder: null },
  { key: "Total", label: "Actual Total (良品数)", category: "production", defaultOrder: 9 },
  { key: "Process_Quantity", label: "Quantity Made (加工数)", category: "production", defaultOrder: 10 },
  { key: "ショット数", label: "Shot Count (ショット数)", category: "production", defaultOrder: null },
  { key: "スペアからの部分数", label: "Spare Parts Count (スペアからの部分数)", category: "production", defaultOrder: null },
  { key: "Spare", label: "Spare (予備)", category: "production", defaultOrder: null },

  { key: "Total_NG", label: "Total NG (不良合計)", category: "quality", defaultOrder: null },
  { key: "疵引不良", label: "Non Conforming Internal (疵引不良)", category: "quality", defaultOrder: null },
  { key: "加工不良", label: "Non Conforming Supplier (加工不良)", category: "quality", defaultOrder: null },
  { key: "その他", label: "Other NG (その他)", category: "quality", defaultOrder: null },
  { key: "疵引処理数", label: "Scratch Processed Qty (疵引処理数)", category: "quality", defaultOrder: null },
  { key: "Quality_Check_Count", label: "Quality Checks Count", category: "quality", defaultOrder: null },

  { key: "Time_start", label: "Start Time (開始時刻)", category: "timing", defaultOrder: 7 },
  { key: "Time_end", label: "End Time (終了時刻)", category: "timing", defaultOrder: 8 },
  { key: "Total_Work_Hours", label: "Total Work Hours (稼働時間)", category: "timing", defaultOrder: null },
  { key: "Cycle_Time", label: "Cycle Time (s) (サイクルタイム)", category: "timing", defaultOrder: null },
  { key: "Total_Break_Minutes", label: "Break Time (min) (休憩時間・分)", category: "timing", defaultOrder: null },
  { key: "Total_Break_Hours", label: "Break Time (hrs) (休憩時間・時)", category: "timing", defaultOrder: null },

  { key: "WorkOrder_Assigned_Machine", label: "Assigned To", category: "workorder", defaultOrder: null },
  { key: "WorkOrder_Status", label: "Work Order Status", category: "workorder", defaultOrder: null },
  { key: "WorkOrder_Target_Machines", label: "Target Machines", category: "workorder", defaultOrder: null },
  { key: "WorkOrder_NC_Program_Sent", label: "NC Program Sent", category: "workorder", defaultOrder: null },

  { key: "材料ロット", label: "Material Lot (材料ロット)", category: "additional", defaultOrder: null },
  { key: "Comment", label: "Comment (コメント)", category: "additional", defaultOrder: null },
];

export const SCNA_MACHINE_EXPORT_CATEGORIES = [
  { key: "basic", title: "📋 Basic Information", titleJa: "📋 基本情報" },
  { key: "production", title: "🏭 Production Details", titleJa: "🏭 生産詳細" },
  { key: "quality", title: "✅ Quality & NG Data", titleJa: "✅ 品質・不良データ" },
  { key: "timing", title: "⏱️ Timing & Breaks", titleJa: "⏱️ 時間・休憩" },
  { key: "breaks", title: "☕ Break Details", titleJa: "☕ 休憩詳細" },
  { key: "qualitychecks", title: "🔍 Quality Checks", titleJa: "🔍 品質チェック" },
  { key: "maintenance", title: "🔧 Maintenance & Trouble", titleJa: "🔧 メンテナンス・トラブル" },
  { key: "workorder", title: "📦 Work Order Info", titleJa: "📦 ワークオーダー情報" },
  { key: "images", title: "🖼️ Images", titleJa: "🖼️ 画像" },
  { key: "additional", title: "📝 Additional Info", titleJa: "📝 追加情報" },
  { key: "other", title: "🗂️ Other Fields", titleJa: "🗂️ その他のフィールド" },
];

// English labels for nested/extra fields (from legacy getMachineFieldMapping)
const SCNA_DYNAMIC_FIELD_LABELS = {
  "Break_Time_Data.break1.start": "Break 1 Start",
  "Break_Time_Data.break1.end": "Break 1 End",
  "Break_Time_Data.break2.start": "Break 2 Start",
  "Break_Time_Data.break2.end": "Break 2 End",
  "Break_Time_Data.break3.start": "Break 3 Start",
  "Break_Time_Data.break3.end": "Break 3 End",
  "Break_Time_Data.break4.start": "Break 4 Start",
  "Break_Time_Data.break4.end": "Break 4 End",
  "Maintenance_Data.totalMinutes": "Maintenance Minutes",
  "Maintenance_Data.totalHours": "Maintenance Hours",
  Total_Trouble_Minutes: "Trouble Minutes",
  Total_Trouble_Hours: "Trouble Hours",
  "2HourQualityCheck.lastCheckTimestamp": "Last Quality Check Time",
  "WorkOrder_Info.isWorkOrder": "Is Work Order",
  "初物チェック画像": "First Cycle Check Image (初物チェック画像)",
  "終物チェック画像": "Last Cycle Check Image (終物チェック画像)",
  "材料ラベル画像": "Material Label Image (材料ラベル画像)",
  materialLabelImages: "Material Label Images",
  materialLabelImageCount: "Material Label Count",
  shot1: "Shot 1",
  shot2: "Shot 2",
};

// Flattened keys already exposed through curated (computed) columns
const SCNA_CURATED_FLAT_KEYS = new Set([
  "_id",
  "WorkOrder_Info.workOrderNumber",
  "WorkOrder_Info.sku",
  "WorkOrder_Info.productName",
  "WorkOrder_Info.requiredQuantity",
  "WorkOrder_Info.assignedTo",
  "WorkOrder_Info.assignedMachine",
  "WorkOrder_Info.status",
  "WorkOrder_Info.targetMachines",
  "WorkOrder_Info.ncProgramSent",
  "2HourQualityCheck.totalChecks",
  "Break_Time_Data.totalBreakMinutes",
  "Break_Time_Data.totalBreakHours",
]);

/**
 * Flatten nested objects with dot notation (legacy flattenMachineObject).
 * Arrays of primitives are joined; arrays of objects get [index] keys.
 */
export function flattenMachineRecord(obj, prefix = "", out = {}) {
  if (!obj || typeof obj !== "object") return out;
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    const path = `${prefix}${key}`;
    if (value === null || value === undefined) {
      out[path] = "";
    } else if (Array.isArray(value)) {
      if (value.length > 0 && value[0] && typeof value[0] === "object") {
        value.forEach((item, index) =>
          flattenMachineRecord(item, `${path}[${index}].`, out)
        );
      } else {
        out[path] = value.join(", ");
      }
    } else if (typeof value === "object" && !(value instanceof Date)) {
      flattenMachineRecord(value, `${path}.`, out);
    } else {
      out[path] = value;
    }
  });
  return out;
}

function categorizeDynamicField(key) {
  if (/^Break_Time_Data|break/i.test(key)) return "breaks";
  if (/QualityCheck|Quality_Check_Data/.test(key)) return "qualitychecks";
  if (/Maintenance|Trouble/i.test(key)) return "maintenance";
  if (/^WorkOrder_Info/.test(key)) return "workorder";
  if (/image|画像/i.test(key)) return "images";
  return "other";
}

/**
 * Build extra export columns for every flattened field present in the records
 * that is not already covered by SCNA_MACHINE_EXPORT_COLUMNS.
 */
export function buildDynamicMachineExportColumns(records = []) {
  const curatedKeys = new Set(SCNA_MACHINE_EXPORT_COLUMNS.map((col) => col.key));
  const discovered = new Set();
  records.forEach((record) => {
    Object.keys(flattenMachineRecord(record)).forEach((key) => discovered.add(key));
  });

  return Array.from(discovered)
    .filter((key) => !curatedKeys.has(key) && !SCNA_CURATED_FLAT_KEYS.has(key))
    .sort()
    .map((key) => ({
      key,
      label: SCNA_DYNAMIC_FIELD_LABELS[key] || key,
      category: categorizeDynamicField(key),
      defaultOrder: null,
      dynamic: true,
    }));
}

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
      { key: "Total_Work_Hours", order: 10 },
      { key: "Process_Quantity", order: 11 },
      { key: "Total", order: 12 },
      { key: "Total_NG", order: 13 },
      { key: "Cycle_Time", order: 14 },
      { key: "Total_Break_Minutes", order: 15 },
      { key: "Quality_Check_Count", order: 16 },
      { key: "材料ロット", order: 17 },
      { key: "Comment", order: 18 },
    ],
  },
};

export function extractMachineExportValue(record = {}, columnKey) {
  switch (columnKey) {
    case "WorkOrder_No":
      return record.WorkOrder_Info?.workOrderNumber || "";
    case "Product_Name":
      return record.WorkOrder_Info?.sku || record.WorkOrder_Info?.productName || "";
    case "Required_Quantity":
      return record.WorkOrder_Info?.requiredQuantity || "";
    case "WorkOrder_Assigned_Machine":
      return record.WorkOrder_Info?.assignedTo || record.WorkOrder_Info?.assignedMachine || "";
    case "WorkOrder_Status":
      return record.WorkOrder_Info?.status || "";
    case "WorkOrder_Target_Machines":
      return Array.isArray(record.WorkOrder_Info?.targetMachines)
        ? record.WorkOrder_Info.targetMachines.join(", ")
        : record.WorkOrder_Info?.targetMachines || "";
    case "WorkOrder_NC_Program_Sent":
      if (record.WorkOrder_Info?.ncProgramSent === undefined) return "";
      return record.WorkOrder_Info.ncProgramSent ? "Yes" : "No";
    case "Total_Break_Minutes":
      return record.Total_Break_Minutes ?? record.Break_Time_Data?.totalBreakMinutes ?? 0;
    case "Total_Break_Hours":
      return record.Total_Break_Hours ?? record.Break_Time_Data?.totalBreakHours ?? 0;
    case "Quality_Check_Count":
      return (
        record["2HourQualityCheck"]?.totalChecks ??
        record.Quality_Check_Data?.totalChecks ??
        0
      );
    case "Cycle_Time":
      return record.Cycle_Time ? Number(record.Cycle_Time).toFixed(2) : "";
    default:
      return record[columnKey] !== undefined && record[columnKey] !== null
        ? record[columnKey]
        : "";
  }
}

