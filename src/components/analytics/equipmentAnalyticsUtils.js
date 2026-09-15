/**
 * Utility functions for Equipment / Machine Performance Analytics
 */

/**
 * Calculates a date range containing the specified number of business days (Mon-Fri).
 * Matches the legacy FreyaAdmin 7 business-day default.
 */
export function getBusinessDayRange(daysCount = 7) {
  const endDate = new Date();
  let currentDate = new Date(endDate);
  let businessDaysFound = 0;

  // Include current day if it's a weekday
  if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
    businessDaysFound = 1;
  }

  while (businessDaysFound < daysCount) {
    currentDate.setDate(currentDate.getDate() - 1);
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDaysFound++;
    }
  }

  const format = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    startDate: format(currentDate),
    endDate: format(endDate),
  };
}

/**
 * Calculates aggregate KPIs for a specific machine from its raw production records.
 */
export function calculateEquipmentAnalytics(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      totalDays: 0,
      totalShots: 0,
      totalProcessQuantity: 0,
      totalDefects: 0,
      workingHours: 0,
      avgShotsPerDay: 0,
      avgShotsPerHour: 0,
      avgWorkingHoursPerDay: 0,
      defectRate: 0,
    };
  }

  const distinctDates = new Set(records.map((r) => r.Date).filter(Boolean));
  const totalDays = distinctDates.size;

  let totalShots = 0;
  let totalProcessQuantity = 0;
  let totalDefects = 0;
  let workingHours = 0;

  for (const r of records) {
    totalShots += Number(r["ショット数"] || 0);
    totalProcessQuantity += Number(r.Process_Quantity || 0);
    totalDefects += Number(r.Total_NG || r.SRS_Total_NG || 0);

    if (r.Time_start && r.Time_end) {
      const [sh, sm] = String(r.Time_start).split(":").map(Number);
      const [eh, em] = String(r.Time_end).split(":").map(Number);
      if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
        const diffMinutes = eh * 60 + em - (sh * 60 + sm);
        if (diffMinutes > 0) {
          workingHours += diffMinutes / 60;
        }
      }
    }
  }

  return {
    totalDays,
    totalShots,
    totalProcessQuantity,
    totalDefects,
    workingHours: Number(workingHours.toFixed(2)),
    avgShotsPerDay: totalDays > 0 ? Number((totalShots / totalDays).toFixed(1)) : 0,
    avgShotsPerHour: workingHours > 0 ? Number((totalShots / workingHours).toFixed(1)) : 0,
    avgWorkingHoursPerDay: totalDays > 0 ? Number((workingHours / totalDays).toFixed(2)) : 0,
    defectRate:
      totalProcessQuantity > 0 ? Number(((totalDefects / totalProcessQuantity) * 100).toFixed(2)) : 0,
  };
}

/**
 * Groups production records by equipment name (設備).
 */
export function groupRecordsByEquipment(records = []) {
  const groups = {};
  if (!Array.isArray(records)) return groups;

  for (const item of records) {
    const equip = item["設備"] || "Unknown";
    if (!groups[equip]) {
      groups[equip] = [];
    }
    groups[equip].push(item);
  }

  return groups;
}

/**
 * Exports a machine's records to CSV file.
 */
export function exportEquipmentToCsv(equipmentName, records = [], isJa = true) {
  if (!records || records.length === 0) return;

  const headers = isJa
    ? ["日付", "工場", "設備", "品番", "背番号", "作業者", "ショット数", "処理数量", "不良数", "開始時間", "終了時間", "実働時間(h)"]
    : ["Date", "Factory", "Equipment", "Part Number", "Back Number", "Worker", "Shots", "Process Qty", "Defects", "Time Start", "Time End", "Working Hours"];

  const rows = records.map((r) => {
    let hours = "";
    if (r.Time_start && r.Time_end) {
      const [sh, sm] = String(r.Time_start).split(":").map(Number);
      const [eh, em] = String(r.Time_end).split(":").map(Number);
      if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff > 0) hours = (diff / 60).toFixed(2);
      }
    }

    return [
      r.Date || "",
      r["工場"] || "",
      r["設備"] || equipmentName || "",
      r["品番"] || "",
      r["背番号"] || "",
      r["作業者"] || r.Worker_Name || "",
      r["ショット数"] ?? 0,
      r.Process_Quantity ?? 0,
      r.Total_NG ?? r.SRS_Total_NG ?? 0,
      r.Time_start || "",
      r.Time_end || "",
      hours,
    ];
  });

  const csvContent =
    "\uFEFF" + // BOM for Excel UTF-8
    [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `equipment_${equipmentName}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
