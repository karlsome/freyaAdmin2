export const PLANNER_CONFIG = {
  workStartTime: "08:45",
  workEndTime: "20:00",
  intervalMinutes: 15,
  defaultCycleTime: 22.5,
  defaultPcPerCycle: 1,
};

export const DEFAULT_BREAKS = [
  { id: "default-lunch", name: "Lunch Break", start: "12:00", end: "12:45", isDefault: true, equipment: null },
  { id: "default-break", name: "Break", start: "15:00", end: "15:15", isDefault: true, equipment: null },
];

const PRODUCT_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#F43F5E", "#A855F7", "#22C55E", "#FBBF24",
  "#E879F9", "#2DD4BF", "#FB7185", "#A3E635", "#818CF8",
];

function hashString(input) {
  let hash = 0;
  const value = String(input || "");

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function normalizeEquipmentParts(equipment = "") {
  return String(equipment)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function createScheduleId(seed = "") {
  return `sched_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}_${String(seed).slice(0, 8)}`;
}

export function cloneBreaks(breaks = DEFAULT_BREAKS) {
  return (Array.isArray(breaks) ? breaks : DEFAULT_BREAKS).map((item) => ({ ...item }));
}

export function getUserDisplayName(authUser = {}) {
  const firstName = String(authUser?.firstName || "").trim();
  const lastName = String(authUser?.lastName || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || authUser?.username || "Unknown";
}

export function timeToMinutes(timeStr) {
  if (typeof timeStr !== "string" || !timeStr.includes(":")) return 0;

  const [hoursPart, minutesPart] = timeStr.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return Math.round((hours * 60) + minutes);
}

export function minutesToTime(totalMinutes) {
  const wholeMinutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(wholeMinutes / 60);
  const minutes = wholeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.round((safeSeconds % 3600) / 60);

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function getMatchingProduct(item, products = []) {
  if (!item) return null;

  return products.find((product) => (
    (item.背番号 && product.背番号 === item.背番号)
    || (item.品番 && product.品番 === item.品番)
    || (item._id && String(product._id) === String(item._id))
  )) || null;
}

export function getProductCapacity(item, products = []) {
  const directCapacity = Number(item?.["収容数"] || 0);
  if (directCapacity > 0) return directCapacity;

  const product = getMatchingProduct(item, products);
  const matchedCapacity = Number(product?.["収容数"] || 0);

  return matchedCapacity > 0 ? matchedCapacity : 1;
}

export function calculateBoxesNeeded(item, quantity, products = []) {
  const capacity = getProductCapacity(item, products);
  const safeQuantity = Math.max(0, Number(quantity) || 0);

  return Math.ceil(safeQuantity / capacity);
}

export function calculateProductionTime(item, quantity) {
  const cycleTimeSeconds = Number(item?.["秒数(1pcs何秒)"] || PLANNER_CONFIG.defaultCycleTime) || PLANNER_CONFIG.defaultCycleTime;
  const pcPerCycle = Number(item?.pcPerCycle || PLANNER_CONFIG.defaultPcPerCycle) || PLANNER_CONFIG.defaultPcPerCycle;
  const safeQuantity = Math.max(0, Number(quantity) || 0);
  const cyclesNeeded = Math.ceil(safeQuantity / pcPerCycle);
  const totalSeconds = cyclesNeeded * cycleTimeSeconds;

  return {
    totalSeconds,
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    cyclesNeeded,
    formattedTime: formatDuration(totalSeconds),
  };
}

function getProductIdentity(item) {
  return item?.背番号 || item?.品番 || item?.品名 || JSON.stringify(item || {});
}

export function isGroupEquipment(equipment = "") {
  return normalizeEquipmentParts(equipment).length > 1;
}

function getSpecialPlannerColor(item, products = []) {
  const product = getMatchingProduct(item, products) || item;
  const model = String(product?.モデル || "").trim();
  const serial = String(product?.背番号 || "");

  if (model !== "992W(310D)" || !serial) return null;

  switch (serial.charAt(0)) {
    case "1":
    case "5":
      return "#10B981";
    case "2":
    case "6":
      return "#6B7280";
    case "3":
    case "7":
      return "#1E40AF";
    case "4":
    case "8":
      return "#0EA5E9";
    default:
      return null;
  }
}

export function getColorForProduct(item, products = []) {
  const special = getSpecialPlannerColor(item, products);
  if (special) return special;

  return PRODUCT_COLORS[hashString(getProductIdentity(item)) % PRODUCT_COLORS.length];
}

export function buildProductColorMap(products = [], extraItems = []) {
  const productColors = {};

  [...products, ...extraItems].forEach((item) => {
    if (!item?.背番号) return;
    if (!productColors[item.背番号]) {
      productColors[item.背番号] = getColorForProduct(item, products);
    }
  });

  return productColors;
}

function sanitizeStartTime(startTime) {
  if (!startTime) return "";
  if (String(startTime).includes(".")) {
    return minutesToTime(timeToMinutes(String(startTime)));
  }
  return startTime;
}

export function normalizePlanProducts(planProducts = [], products = [], productColors = {}) {
  return (Array.isArray(planProducts) ? planProducts : []).map((item, index) => {
    const matchedProduct = getMatchingProduct(item, products) || {};
    const merged = { ...matchedProduct, ...item };
    const quantity = Math.max(0, Number(merged.quantity) || 0);
    const estimatedTime = merged.estimatedTime?.totalSeconds
      ? {
          ...merged.estimatedTime,
          formattedTime: merged.estimatedTime.formattedTime || formatDuration(merged.estimatedTime.totalSeconds),
        }
      : calculateProductionTime(merged, quantity);

    return {
      ...merged,
      goalId: merged.goalId || merged._id || matchedProduct?._id || "",
      _scheduleId: merged._scheduleId || merged.scheduleId || createScheduleId(index),
      quantity,
      boxes: calculateBoxesNeeded(merged, quantity, products),
      estimatedTime,
      startTime: sanitizeStartTime(merged.startTime),
      color: productColors[merged.背番号] || getColorForProduct(merged, products),
    };
  });
}

export function isBreakAtSlot(slotMinutes, equipment, breaks = DEFAULT_BREAKS) {
  return (Array.isArray(breaks) ? breaks : []).find((item) => {
    const breakStart = timeToMinutes(item.start);
    const breakEnd = timeToMinutes(item.end);
    const matchesEquipment = !item.equipment || item.equipment === equipment;

    return matchesEquipment && slotMinutes >= breakStart && slotMinutes < breakEnd;
  }) || null;
}

export function findNextAvailableTime(startMinutes, durationMinutes, equipment, breaks = DEFAULT_BREAKS) {
  let currentMinutes = Math.round(Number(startMinutes) || 0);
  let remainingProduction = Math.ceil(Number(durationMinutes) || 0);

  const breakAtStart = isBreakAtSlot(currentMinutes, equipment, breaks);
  if (breakAtStart) {
    currentMinutes = timeToMinutes(breakAtStart.end);
  }

  let scanMinute = currentMinutes;

  while (remainingProduction > 0) {
    if (!isBreakAtSlot(scanMinute, equipment, breaks)) {
      remainingProduction -= 1;
    }
    scanMinute += 1;
  }

  return {
    startTime: currentMinutes,
    endTime: scanMinute,
    actualDuration: scanMinute - currentMinutes,
  };
}

export function getScheduledSpan(item, breaks = DEFAULT_BREAKS) {
  const startMinutes = timeToMinutes(item?.startTime || PLANNER_CONFIG.workStartTime);
  const totalSeconds = Number(item?.estimatedTime?.totalSeconds || 0);
  const durationMinutes = totalSeconds / 60;

  return findNextAvailableTime(startMinutes, durationMinutes, item?.equipment, breaks);
}

export function getLatestEquipmentEnd(scheduledProducts = [], equipment, breaks = DEFAULT_BREAKS) {
  const items = scheduledProducts.filter((item) => item.equipment === equipment && item.startTime);
  if (!items.length) {
    return timeToMinutes(PLANNER_CONFIG.workStartTime);
  }

  return Math.max(...items.map((item) => getScheduledSpan(item, breaks).endTime));
}

export function getTimelineSlots(scheduledProducts = [], actualBlocks = [], breaks = DEFAULT_BREAKS) {
  const slots = [];
  const startMinutes = timeToMinutes(PLANNER_CONFIG.workStartTime);
  let endMinutes = timeToMinutes(PLANNER_CONFIG.workEndTime);

  scheduledProducts.forEach((item) => {
    if (!item?.startTime || !item?.estimatedTime?.totalSeconds) return;
    const span = getScheduledSpan(item, breaks);
    endMinutes = Math.max(endMinutes, span.endTime);
  });

  actualBlocks.forEach((block) => {
    const end = timeToMinutes(block?.endTime || PLANNER_CONFIG.workEndTime);
    endMinutes = Math.max(endMinutes, end);
  });

  for (let minute = startMinutes; minute <= endMinutes; minute += PLANNER_CONFIG.intervalMinutes) {
    slots.push(minutesToTime(minute));
  }

  return slots;
}

export function getFirstVisibleSlotMinutes(item, breaks = DEFAULT_BREAKS) {
  let current = timeToMinutes(item?.startTime || PLANNER_CONFIG.workStartTime);

  while (isBreakAtSlot(current, item?.equipment, breaks)) {
    current += PLANNER_CONFIG.intervalMinutes;
  }

  return current;
}

export function isSlotOccupiedByProduct(slotMinutes, item, breaks = DEFAULT_BREAKS) {
  if (!item?.startTime || !item?.estimatedTime?.totalSeconds) return false;

  const span = getScheduledSpan(item, breaks);
  const slotEnd = slotMinutes + PLANNER_CONFIG.intervalMinutes;

  if (slotEnd <= span.startTime || slotMinutes >= span.endTime) return false;

  for (let minute = slotMinutes; minute < slotEnd; minute += 1) {
    if (minute >= span.startTime && minute < span.endTime && !isBreakAtSlot(minute, item.equipment, breaks)) {
      return true;
    }
  }

  return false;
}

export function getProductForSlot(slotMinutes, equipment, scheduledProducts = [], breaks = DEFAULT_BREAKS) {
  return scheduledProducts.find((item) => item.equipment === equipment && isSlotOccupiedByProduct(slotMinutes, item, breaks)) || null;
}

export function processActualProductionData(records = []) {
  if (!Array.isArray(records) || !records.length) return [];

  function roundToNearest15(timeStr) {
    const totalMinutes = timeToMinutes(timeStr);
    const rounded = Math.round(totalMinutes / PLANNER_CONFIG.intervalMinutes) * PLANNER_CONFIG.intervalMinutes;

    return minutesToTime(rounded);
  }

  const grouped = new Map();

  records.forEach((record) => {
    const equipment = record?.設備 || "";
    const serial = record?.背番号 || "";
    const key = `${equipment}_${serial}`;
    const existing = grouped.get(key) || {
      equipment,
      背番号: serial,
      品番: record?.品番 || "",
      品名: record?.品名 || "",
      records: [],
      startTime: null,
      endTime: null,
      totalQuantity: 0,
    };

    const startTime = roundToNearest15(record?.Time_start || "00:00");
    const endTime = roundToNearest15(record?.Time_end || "00:00");
    existing.records.push(record);
    existing.totalQuantity += Number(record?.Process_Quantity || 0);
    existing.startTime = existing.startTime ? (startTime < existing.startTime ? startTime : existing.startTime) : startTime;
    existing.endTime = existing.endTime ? (endTime > existing.endTime ? endTime : existing.endTime) : endTime;

    grouped.set(key, existing);
  });

  return Array.from(grouped.values());
}

export function processInProgressData(records = []) {
  if (!Array.isArray(records) || !records.length) return {};

  const sessionsByEquipment = {};

  records.forEach((record) => {
    const equipment = record?.設備;
    const sessionId = record?.sessionID;
    const timestamp = record?.Timestamp;

    if (!equipment || !sessionId || !timestamp) return;

    if (!sessionsByEquipment[equipment]) sessionsByEquipment[equipment] = {};

    const existing = sessionsByEquipment[equipment][sessionId] || {
      sessionID: sessionId,
      背番号: record?.背番号 || "",
      品番: record?.品番 || "",
      firstTimestamp: timestamp,
      lastTimestamp: timestamp,
      lastStatus: record?.Status || "",
    };

    const currentTime = new Date(timestamp);
    if (currentTime < new Date(existing.firstTimestamp)) existing.firstTimestamp = timestamp;
    if (currentTime > new Date(existing.lastTimestamp)) {
      existing.lastTimestamp = timestamp;
      existing.lastStatus = record?.Status || existing.lastStatus;
    }

    sessionsByEquipment[equipment][sessionId] = existing;
  });

  const slotData = {};

  Object.entries(sessionsByEquipment).forEach(([equipment, sessions]) => {
    slotData[equipment] = {};

    Object.values(sessions).forEach((session) => {
      if (session.lastStatus === "Completed" || session.lastStatus === "Reset") return;

      const start = new Date(session.firstTimestamp);
      const end = new Date(Math.max(Date.now(), new Date(session.lastTimestamp).getTime()));
      const cursor = new Date(start);
      cursor.setMinutes(Math.floor(cursor.getMinutes() / PLANNER_CONFIG.intervalMinutes) * PLANNER_CONFIG.intervalMinutes, 0, 0);

      while (cursor <= end) {
        const slot = `${String(cursor.getHours()).padStart(2, "0")}:${String(cursor.getMinutes()).padStart(2, "0")}`;
        if (!slotData[equipment][slot]) {
          slotData[equipment][slot] = {
            背番号: session.背番号,
            品番: session.品番,
            sessionID: session.sessionID,
          };
        }
        cursor.setMinutes(cursor.getMinutes() + PLANNER_CONFIG.intervalMinutes);
      }
    });
  });

  return slotData;
}

export function equipmentConflicts(leftEquipment, rightEquipment) {
  if (leftEquipment === rightEquipment) return true;

  const leftParts = normalizeEquipmentParts(leftEquipment);
  const rightParts = normalizeEquipmentParts(rightEquipment);

  return leftParts.some((part) => rightParts.includes(part));
}

export function timeRangesOverlap(startA, endA, startB, endB, equipment, breaks = DEFAULT_BREAKS) {
  const leftStart = typeof startA === "string" ? timeToMinutes(startA) : Number(startA);
  const leftEnd = typeof endA === "string" ? timeToMinutes(endA) : Number(endA);
  const rightStart = typeof startB === "string" ? timeToMinutes(startB) : Number(startB);
  const rightEnd = typeof endB === "string" ? timeToMinutes(endB) : Number(endB);

  const overlapStart = Math.max(leftStart, rightStart);
  const overlapEnd = Math.min(leftEnd, rightEnd);

  if (overlapStart >= overlapEnd) return false;

  for (let minute = overlapStart; minute < overlapEnd; minute += 1) {
    if (!isBreakAtSlot(minute, equipment, breaks)) {
      return true;
    }
  }

  return false;
}

export function hasSchedulingConflict(candidateItem, existingItems = [], breaks = DEFAULT_BREAKS, options = {}) {
  const candidateSpan = getScheduledSpan(candidateItem, breaks);
  const ignoreScheduleId = options.ignoreScheduleId || null;

  for (const existing of existingItems) {
    if (ignoreScheduleId && existing._scheduleId === ignoreScheduleId) continue;
    if (!equipmentConflicts(candidateItem.equipment, existing.equipment)) continue;

    const existingSpan = getScheduledSpan(existing, breaks);
    const overlaps = timeRangesOverlap(
      candidateSpan.startTime,
      candidateSpan.endTime,
      existingSpan.startTime,
      existingSpan.endTime,
      candidateItem.equipment,
      breaks,
    );

    if (overlaps) {
      return {
        hasConflict: true,
        conflictingItem: existing,
        conflictingRange: `${existing.startTime} - ${minutesToTime(existingSpan.endTime)}`,
      };
    }
  }

  return { hasConflict: false, conflictingItem: null, conflictingRange: "" };
}

export function groupGoalsByDate(goals = []) {
  return goals.reduce((groups, goal) => {
    const date = goal?.date || "Unknown";
    if (!groups[date]) groups[date] = [];
    groups[date].push(goal);
    return groups;
  }, {});
}

export function sortGoals(goals = []) {
  return [...goals].sort((left, right) => {
    if (left.date !== right.date) return String(left.date).localeCompare(String(right.date));

    const leftComplete = left.status === "completed" || Number(left.remainingQuantity || 0) <= 0;
    const rightComplete = right.status === "completed" || Number(right.remainingQuantity || 0) <= 0;
    if (leftComplete !== rightComplete) return leftComplete ? 1 : -1;

    return String(left.背番号 || "").localeCompare(String(right.背番号 || ""), "ja");
  });
}

export function getAssignedEquipmentForGoal(goal, scheduledProducts = []) {
  const equipments = scheduledProducts
    .filter((item) => (
      (goal?._id && item.goalId === goal._id)
      || (goal?.背番号 && item.背番号 === goal.背番号)
    ))
    .map((item) => item.equipment)
    .filter(Boolean);

  return [...new Set(equipments)];
}

export function getPlannerGoalState(goal) {
  const targetQuantity = Number(goal?.targetQuantity || 0);
  const scheduledQuantity = Number(goal?.scheduledQuantity || 0);
  const remainingQuantity = Number(goal?.remainingQuantity ?? (targetQuantity - scheduledQuantity));
  const percentage = targetQuantity > 0 ? Math.min(100, Math.round((scheduledQuantity / targetQuantity) * 100)) : 0;
  const isCompleted = remainingQuantity <= 0 || scheduledQuantity >= targetQuantity;
  const isInProgress = !isCompleted && scheduledQuantity > 0;

  if (isCompleted) {
    return {
      percentage,
      isCompleted,
      isInProgress,
      barClassName: "bg-emerald-500",
      surfaceClassName: "border-emerald-500/25 bg-emerald-500/8",
      textClassName: "text-emerald-600 dark:text-emerald-300",
      dotClassName: "bg-emerald-500",
      label: "Completed",
    };
  }

  if (isInProgress) {
    return {
      percentage,
      isCompleted,
      isInProgress,
      barClassName: "bg-amber-500",
      surfaceClassName: "border-amber-500/25 bg-amber-500/8",
      textClassName: "text-amber-600 dark:text-amber-300",
      dotClassName: "bg-amber-500",
      label: "In Progress",
    };
  }

  return {
    percentage,
    isCompleted,
    isInProgress,
    barClassName: "bg-rose-500",
    surfaceClassName: "border-rose-500/25 bg-rose-500/8",
    textClassName: "text-rose-600 dark:text-rose-300",
    dotClassName: "bg-rose-500",
    label: "Pending",
  };
}

export function getEffectiveWorkMinutes(breaks = DEFAULT_BREAKS, equipment = null) {
  const workStart = timeToMinutes(PLANNER_CONFIG.workStartTime);
  const workEnd = timeToMinutes(PLANNER_CONFIG.workEndTime);
  const totalMinutes = workEnd - workStart;

  const breakMinutes = (Array.isArray(breaks) ? breaks : []).reduce((sum, item) => {
    const matchesEquipment = !equipment || !item.equipment || item.equipment === equipment;
    if (!matchesEquipment) return sum;
    return sum + Math.max(0, timeToMinutes(item.end) - timeToMinutes(item.start));
  }, 0);

  return Math.max(1, totalMinutes - breakMinutes);
}

export function getEquipmentUtilization(scheduledProducts = [], equipment, breaks = DEFAULT_BREAKS) {
  const products = scheduledProducts.filter((item) => item.equipment === equipment);
  const totalMinutes = products.reduce((sum, item) => sum + ((Number(item?.estimatedTime?.totalSeconds || 0)) / 60), 0);
  const utilization = Math.round((totalMinutes / getEffectiveWorkMinutes(breaks, equipment)) * 100);

  return {
    totalMinutes,
    utilization,
    formattedTime: formatDuration(totalMinutes * 60),
  };
}

export function sortScheduledProducts(scheduledProducts = []) {
  return [...scheduledProducts].sort((left, right) => {
    if (left.equipment !== right.equipment) return String(left.equipment).localeCompare(String(right.equipment), "ja");
    return timeToMinutes(left.startTime) - timeToMinutes(right.startTime);
  });
}

export function createScheduledItem({ goal, equipment, quantity, startMinutes, products = [], productColors = {}, breaks = DEFAULT_BREAKS }) {
  const estimatedTime = calculateProductionTime(goal, quantity);
  const timing = findNextAvailableTime(startMinutes, estimatedTime.totalSeconds / 60, equipment, breaks);

  return {
    ...getMatchingProduct(goal, products),
    ...goal,
    goalId: goal._id,
    _scheduleId: createScheduleId(goal._id),
    equipment,
    quantity,
    boxes: calculateBoxesNeeded(goal, quantity, products),
    estimatedTime,
    startTime: minutesToTime(timing.startTime),
    color: productColors[goal.背番号] || getColorForProduct(goal, products),
  };
}

function getMaterialSuffix(serial = "") {
  return serial.length >= 2 ? serial.slice(1) : "";
}

function is992WProduct(goal, products = []) {
  const fullProduct = getMatchingProduct(goal, products) || goal;
  return String(fullProduct?.モデル || "").trim() === "992W(310D)";
}

export function buildSmartAssignments(goals = [], currentDate, trends = {}, products = []) {
  const todaysGoals = goals.filter((goal) => goal.date === currentDate && Number(goal.remainingQuantity || 0) > 0);
  const assignments = {};
  const tdLockedEquipment = { group: null, single: null };
  let totalAssigned = 0;
  let totalUnassigned = 0;

  const sortedGoals = [...todaysGoals].sort((left, right) => {
    const leftIs992W = is992WProduct(left, products);
    const rightIs992W = is992WProduct(right, products);

    if (leftIs992W && !rightIs992W) return -1;
    if (!leftIs992W && rightIs992W) return 1;
    if (!leftIs992W && !rightIs992W) return 0;

    const leftMaterial = getMaterialSuffix(String(left?.背番号 || ""));
    const rightMaterial = getMaterialSuffix(String(right?.背番号 || ""));
    const leftIsTD = leftMaterial === "TD";
    const rightIsTD = rightMaterial === "TD";

    if (leftIsTD && !rightIsTD) return -1;
    if (!leftIsTD && rightIsTD) return 1;
    if (leftMaterial !== rightMaterial) return leftMaterial.localeCompare(rightMaterial);

    return String(left?.背番号 || "").localeCompare(String(right?.背番号 || ""), "ja");
  });

  sortedGoals.forEach((goal) => {
    const identifier = goal.背番号 || goal.品番;
    const trend = trends[identifier];
    const is992W = is992WProduct(goal, products);
    let bestEquipment = null;

    if (is992W && goal.背番号 && trend?.equipmentDistribution) {
      const firstDigit = Number(String(goal.背番号).charAt(0));
      const material = getMaterialSuffix(String(goal.背番号));
      const needsGroup = firstDigit >= 1 && firstDigit <= 4;
      const equipmentType = needsGroup ? "group" : "single";

      if (material === "TD" && tdLockedEquipment[equipmentType]) {
        bestEquipment = tdLockedEquipment[equipmentType];
      } else {
        const equipmentOptions = Object.entries(trend.equipmentDistribution)
          .filter(([equipment]) => (needsGroup ? isGroupEquipment(equipment) : !isGroupEquipment(equipment)))
          .map(([equipment, frequency]) => {
            const materialBonus = (assignments[equipment] || []).filter((item) => {
              return is992WProduct(item, products) && getMaterialSuffix(String(item.背番号 || "")) === material;
            }).length * 1000;

            return {
              equipment,
              score: Number(frequency) + materialBonus,
            };
          })
          .sort((left, right) => right.score - left.score);

        if (equipmentOptions.length > 0) {
          bestEquipment = equipmentOptions[0].equipment;
          if (material === "TD" && !tdLockedEquipment[equipmentType]) {
            tdLockedEquipment[equipmentType] = bestEquipment;
          }
        }
      }
    } else if (trend?.mostFrequentEquipment) {
      bestEquipment = trend.mostFrequentEquipment;
    }

    if (!bestEquipment) {
      totalUnassigned += 1;
      return;
    }

    if (!assignments[bestEquipment]) assignments[bestEquipment] = [];

    assignments[bestEquipment].push({
      ...goal,
      quantity: Number(goal.remainingQuantity || 0),
      confidence: trend?.totalRecords ? (Number(trend.frequency || 0) / Number(trend.totalRecords)) : 0,
    });

    totalAssigned += 1;
  });

  return {
    assignments,
    totalAssigned,
    totalUnassigned,
    sourceGoals: todaysGoals,
  };
}