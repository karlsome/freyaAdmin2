// Auto-plan preview engine: simulation of the demand-driven schedule plus
// the editable "draft" operations (move / swap / box adjust / insert).
// Ported from the legacy FreyaAdmin planner.js so behaviour stays identical.
//
// Every function is pure. Shared inputs travel in a `ctx` object:
//   { breaks, unavailableEquipment, scheduleUntilMinutes, scheduleUntilTime,
//     rowByKey (Map<"背番号::品番", priorityRow>), productColors }

import {
  PLANNER_CONFIG,
  findNextAvailableTime,
  formatDuration,
  isBreakAtSlot,
  isEquipmentUnavailable,
  minutesToTime,
  timeToMinutes,
} from "./planner";

const INTERVAL = PLANNER_CONFIG.intervalMinutes;

// ─── Context ────────────────────────────────────────────────────────────────

export function normalizeScheduleUntilTime(value = "") {
  const fallback = timeToMinutes(PLANNER_CONFIG.workEndTime);
  const minimum = timeToMinutes(PLANNER_CONFIG.workStartTime) + INTERVAL;
  const maximum = 24 * 60 - INTERVAL;
  const text = String(value || "").trim();
  let minutes = /^\d{2}:\d{2}$/.test(text) ? timeToMinutes(text) : fallback;
  if (!Number.isFinite(minutes)) minutes = fallback;
  minutes = Math.max(minimum, Math.min(maximum, minutes));
  return minutesToTime(Math.floor(minutes / INTERVAL) * INTERVAL);
}

export function productKey(item = {}) {
  const a = String(item.背番号 || "").trim();
  const b = String(item.品番 || "").trim();
  return a || b ? `${a}::${b}` : "";
}

export function createPreviewContext({ priorityRows = [], breaks = [], unavailableEquipment = [], scheduleUntilTime = "", productColors = {} } = {}) {
  const time = normalizeScheduleUntilTime(scheduleUntilTime);
  const rowByKey = new Map();
  (Array.isArray(priorityRows) ? priorityRows : []).forEach((row) => {
    const key = productKey(row);
    if (key && !rowByKey.has(key)) rowByKey.set(key, row);
  });
  return {
    breaks,
    unavailableEquipment,
    scheduleUntilTime: time,
    scheduleUntilMinutes: timeToMinutes(time),
    rowByKey,
    productColors,
  };
}

export function roundToInterval(minutes, mode = "ceil") {
  const value = Number.isFinite(Number(minutes)) ? Number(minutes) : 0;
  return Math.round((mode === "floor" ? Math.floor(value / INTERVAL) : Math.ceil(value / INTERVAL)) * INTERVAL);
}

// ─── Product / machine resolution ───────────────────────────────────────────

const num = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function equipmentParts(equipment = "") {
  return String(equipment || "").split(",").map((part) => part.trim()).filter(Boolean);
}

export function sharesEquipmentParts(left = "", right = "") {
  const l = equipmentParts(left);
  const r = equipmentParts(right);
  return l.length > 0 && r.length > 0 && l.some((part) => r.includes(part));
}

function getCapabilityMachine(ctx, item, equipment) {
  const row = ctx.rowByKey.get(productKey(item));
  const name = String(equipment || "").trim();
  if (!row || !name) return null;
  return (row.eligibleMachines || []).find((machine) => String(machine?.equipment || machine?.設備 || "").trim() === name) || null;
}

function resolveCycleSeconds(ctx, item, equipment) {
  const override = num(getCapabilityMachine(ctx, item, equipment)?.cycleTimeSeconds);
  if (override && override > 0) return override;
  const master = num(item?.["秒数(1pcs何秒)"]);
  return master && master > 0 ? master : PLANNER_CONFIG.defaultCycleTime;
}

function resolvePcPerCycle(ctx, item, equipment) {
  const override = num(getCapabilityMachine(ctx, item, equipment)?.pcPerCycle);
  if (override && override > 0) return override;

  const root = num(item?.pcPerCycle);
  const config = item?.machineConfig && typeof item.machineConfig === "object" ? item.machineConfig : null;
  const names = equipmentParts(equipment);
  let master = root;
  if (config && names.length === 1) {
    master = num(config[names[0]]?.pcPerCycle) ?? root;
  } else if (config && names.length > 1) {
    const values = names.map((name) => num(config[name]?.pcPerCycle)).filter((v) => v !== null);
    if (values.length === names.length && values.every((v) => v === values[0])) master = values[0];
  }
  return master && master > 0 ? master : PLANNER_CONFIG.defaultPcPerCycle;
}

export function resolveBoxQuantity(ctx, item, equipment) {
  const override = num(getCapabilityMachine(ctx, item, equipment)?.boxQuantityOverride);
  if (override && override > 0) return override;
  const master = num(item?.["収容数"]) ?? num(item?.boxQuantity);
  return master && master > 0 ? master : 1;
}

export function calcProductionTime(ctx, item, quantity, equipment) {
  // 秒数(1pcs何秒) is seconds per piece, so time = quantity × seconds per piece.
  const cycleSeconds = resolveCycleSeconds(ctx, item, equipment);
  const pc = resolvePcPerCycle(ctx, item, equipment);
  const safeQuantity = Math.max(0, Number(quantity) || 0);
  const cyclesNeeded = Math.ceil(safeQuantity / pc);
  const totalSeconds = safeQuantity * cycleSeconds;
  return {
    totalSeconds,
    totalMinutes: totalSeconds / 60,
    cycleTimeSeconds: cycleSeconds,
    secondsPerPiece: cycleSeconds,
    pcPerCycle: pc,
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    cyclesNeeded,
    formattedTime: formatDuration(totalSeconds),
  };
}

export function calcBoxes(ctx, item, quantity, equipment) {
  return Math.ceil(Math.max(0, Number(quantity) || 0) / resolveBoxQuantity(ctx, item, equipment));
}

// Assignment/priority row → record carrying master fields (rows hold them already).
function productRecord(ctx, like = {}) {
  const row = ctx.rowByKey.get(productKey(like)) || {};
  const populated = Object.fromEntries(Object.entries(like).filter(([, v]) => v !== null && v !== undefined && v !== ""));
  return { ...row, ...populated };
}

// ─── Window helpers ─────────────────────────────────────────────────────────

function assignmentEstimatedTime(ctx, assignment = {}) {
  const existing = assignment.estimatedTime;
  if (existing && Number(existing.totalSeconds) > 0) return { ...existing };
  const quantity = Math.max(0, Number(assignment.quantity || 0));
  const equipment = String(assignment.equipment || "").trim();
  if (quantity <= 0 || !equipment) return null;
  const calc = calcProductionTime(ctx, productRecord(ctx, assignment), quantity, equipment);
  return calc.totalSeconds > 0 ? calc : null;
}

export function assignmentEndMinutes(ctx, assignment = {}) {
  const start = timeToMinutes(assignment.startTime || PLANNER_CONFIG.workStartTime);
  if (!Number.isFinite(start)) return timeToMinutes(PLANNER_CONFIG.workStartTime);

  if (assignment.previewEndTime) {
    const end = timeToMinutes(assignment.previewEndTime);
    if (Number.isFinite(end) && end > start) return end;
  }

  const estimated = assignmentEstimatedTime(ctx, assignment);
  if (!estimated) return roundToInterval(start + INTERVAL);

  const actualEnd = findNextAvailableTime(start, estimated.totalSeconds / 60, assignment.equipment, ctx.breaks).endTime;
  if (!Number.isFinite(actualEnd) || actualEnd <= start) return roundToInterval(start + INTERVAL);
  return roundToInterval(actualEnd);
}

export function occupiedWindows(ctx, assignments = [], equipment = "") {
  return assignments
    .filter((assignment) => sharesEquipmentParts(equipment, assignment.equipment))
    .map((assignment) => ({
      startMinutes: timeToMinutes(assignment.startTime || PLANNER_CONFIG.workStartTime),
      endMinutes: assignmentEndMinutes(ctx, assignment),
    }))
    .filter((w) => Number.isFinite(w.startMinutes) && Number.isFinite(w.endMinutes) && w.endMinutes > w.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)
    .reduce((merged, w) => {
      const last = merged[merged.length - 1];
      if (last && w.startMinutes <= last.endMinutes) {
        last.endMinutes = Math.max(last.endMinutes, w.endMinutes);
      } else {
        merged.push({ ...w });
      }
      return merged;
    }, []);
}

export function findAvailableWindow(ctx, assignments = [], equipment = "", durationMinutes = 0, options = {}) {
  const workStart = timeToMinutes(PLANNER_CONFIG.workStartTime);
  let candidate = Number.isFinite(Number(options.earliestStartMinutes))
    ? Math.max(workStart, Math.round(Number(options.earliestStartMinutes)))
    : workStart;
  candidate = roundToInterval(candidate);

  const windows = occupiedWindows(ctx, assignments, equipment);
  for (const window of windows) {
    if (candidate >= window.endMinutes) continue;
    if (candidate < window.startMinutes) {
      const timing = findNextAvailableTime(candidate, durationMinutes, equipment, ctx.breaks);
      if (timing.endTime <= window.startMinutes) return timing;
    }
    candidate = roundToInterval(Math.max(candidate, window.endMinutes));
  }
  return findNextAvailableTime(candidate, durationMinutes, equipment, ctx.breaks);
}

function availableProductionMinutes(ctx, start, end, equipment) {
  const s = Math.round(Number(start));
  const e = Math.round(Number(end));
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  let total = 0;
  for (let minute = s; minute < e; minute += 1) {
    if (!isBreakAtSlot(minute, equipment, ctx.breaks)) total += 1;
  }
  return total;
}

// ─── Priority rows → scheduling rows ────────────────────────────────────────

const dateSortValue = (value = "") => {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return Number.MAX_SAFE_INTEGER;
  const [y, m, d] = text.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const deliveryOrderValue = (value = null) => {
  const text = String(value ?? "").trim();
  if (!text) return Number.MAX_SAFE_INTEGER;
  const n = Number(text);
  if (Number.isFinite(n)) return n;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
};

function compareRequestNumbers(a = "", b = "") {
  const l = String(a || "").trim();
  const r = String(b || "").trim();
  if (!l && !r) return 0;
  if (!l) return 1;
  if (!r) return -1;
  return l.localeCompare(r, undefined, { numeric: true, sensitivity: "base" });
}

export function comparePriorityRows(left = {}, right = {}) {
  const ld = dateSortValue(left.internalDeadline || left.deliveryDate || "");
  const rd = dateSortValue(right.internalDeadline || right.deliveryDate || "");
  if (ld !== rd) return ld - rd;

  const lo = deliveryOrderValue(left.deliveryOrder);
  const ro = deliveryOrderValue(right.deliveryOrder);
  if (lo !== ro) return lo - ro;

  const rn = compareRequestNumbers(left.requestNumber, right.requestNumber);
  if (rn !== 0) return rn;

  const lq = Number.isFinite(Number(left.queueOrder)) ? Number(left.queueOrder) : Number.MAX_SAFE_INTEGER;
  const rq = Number.isFinite(Number(right.queueOrder)) ? Number(right.queueOrder) : Number.MAX_SAFE_INTEGER;
  if (lq !== rq) return lq - rq;

  const lt = Number(left.requestTimestamp || 0);
  const rt = Number(right.requestTimestamp || 0);
  if (lt !== rt) return lt - rt;

  return Number(left.lineNumber || 0) - Number(right.lineNumber || 0);
}

function materialKey(like = {}) {
  const raw = String(like.背番号 || like.品番 || "").trim().toUpperCase();
  if (!raw) return "";
  const suffix = raw.replace(/^\d+/, "").trim();
  return suffix === raw ? "" : suffix;
}

function requestNumbersOf(row = {}) {
  const grouped = Array.isArray(row.groupedRequestNumbers)
    ? row.groupedRequestNumbers.map((v) => String(v || "").trim()).filter(Boolean)
    : [];
  if (grouped.length > 0) return grouped;
  const single = String(row.requestNumber || "").trim();
  return single ? [single] : [];
}

function bucketKey(row = {}) {
  const deadline = String(row.internalDeadline || row.deliveryDate || "").trim();
  const order = String(row.deliveryOrder ?? "").trim();
  return !deadline && !order ? "" : `${deadline}::${order}`;
}

function sharesBatchScope(a = {}, b = {}) {
  const ar = requestNumbersOf(a);
  const br = requestNumbersOf(b);
  if (ar.length > 0 && br.length > 0) return ar.some((n) => br.includes(n));
  const ak = bucketKey(a);
  return !!ak && ak === bucketKey(b);
}

export function buildSchedulingRows(priorityRows = []) {
  const sorted = [...(Array.isArray(priorityRows) ? priorityRows : [])].sort(comparePriorityRows);

  return sorted.reduce((groups, row) => {
    const shortfall = Number(row.shortfallQuantity || 0);
    if (shortfall <= 0) return groups;

    const key = productKey(row);
    const signature = Array.isArray(row.eligibleMachines)
      ? row.eligibleMachines.map((machine, index) => {
        const equipment = String(machine?.equipment || machine?.設備 || "").trim();
        if (!equipment) return "";
        const priority = Number.isFinite(Number(machine?.priority)) ? Number(machine.priority) : index + 1;
        return `${equipment}:${priority}:${machine?.preferred === true ? "1" : "0"}`;
      }).filter(Boolean).join("|")
      : "";
    const last = groups[groups.length - 1];
    const canMerge = !!(last && key && last.productKey === key && last.candidateSignature === signature
      && last.capabilityStatus === row.capabilityStatus && sharesBatchScope(last, row));
    const boxes = Number.isFinite(Number(row.shortageBoxes)) ? Number(row.shortageBoxes) : null;
    const requestNumber = String(row.requestNumber || "").trim();
    const lineNumber = Number.isFinite(Number(row.lineNumber)) ? Number(row.lineNumber) : null;

    if (!canMerge) {
      groups.push({
        ...row,
        shortfallQuantity: shortfall,
        shortageBoxes: boxes,
        productKey: key,
        candidateSignature: signature,
        groupedRequestNumbers: requestNumber ? [requestNumber] : [],
        groupedLineNumbers: lineNumber !== null ? [lineNumber] : [],
        sourceRowIds: row.id ? [row.id] : [],
      });
      return groups;
    }

    last.shortfallQuantity += shortfall;
    last.shortageBoxes = last.shortageBoxes !== null && boxes !== null ? last.shortageBoxes + boxes : null;
    if (requestNumber && !last.groupedRequestNumbers.includes(requestNumber)) last.groupedRequestNumbers.push(requestNumber);
    if (lineNumber !== null) last.groupedLineNumbers.push(lineNumber);
    if (row.id) last.sourceRowIds.push(row.id);
    return groups;
  }, []).map((group) => {
    const nums = group.groupedRequestNumbers;
    const label = nums.length > 1 ? `${nums[0]} +${nums.length - 1}` : (nums[0] || String(group.requestNumber || "").trim());
    return { ...group, requestNumber: label, requestNumberLabel: label, lineNumber: group.groupedLineNumbers[0] ?? group.lineNumber };
  });
}

export function candidateMachines(ctx, row = {}) {
  return Array.isArray(row.eligibleMachines)
    ? row.eligibleMachines
      .map((machine, index) => ({
        equipment: String(machine?.equipment || machine?.設備 || "").trim(),
        priority: Number.isFinite(Number(machine?.priority)) ? Number(machine.priority) : index + 1,
        preferred: machine?.preferred === true,
        order: index,
      }))
      .filter((machine) => machine.equipment && !isEquipmentUnavailable(machine.equipment, ctx.unavailableEquipment))
    : [];
}

// ─── Machine choice scoring ─────────────────────────────────────────────────

function lastAssignmentFor(ctx, assignments, equipment, cutoff = null) {
  let latest = null;
  let latestEnd = -1;
  assignments.forEach((assignment) => {
    if (!sharesEquipmentParts(equipment, assignment.equipment)) return;
    const end = assignmentEndMinutes(ctx, assignment);
    if (cutoff !== null && end > cutoff) return;
    if (end > latestEnd) {
      latest = assignment;
      latestEnd = end;
    }
  });
  return latest;
}

function affinityRank(ctx, assignments, equipment, row, cutoff) {
  const last = lastAssignmentFor(ctx, assignments, equipment, cutoff);
  if (!last) return 2;
  const key = productKey(row);
  if (key && key === productKey(last)) return 0;
  const m = materialKey(row);
  const lm = materialKey(last);
  if (m && lm) return m === lm ? 1 : 3;
  return 2;
}

const groupingTier = (rank) => (rank === 0 ? 0 : rank === 1 ? 1 : 2);

function batchPotential(ctx, remainingRows, anchor, equipment) {
  const anchorKey = productKey(anchor);
  const anchorMaterial = materialKey(anchor);
  return remainingRows.reduce((t, row) => {
    if (!sharesBatchScope(anchor, row)) return t;
    if (!candidateMachines(ctx, row).some((m) => m.equipment === equipment)) return t;
    const q = Number(row.shortfallQuantity || 0);
    if (q <= 0) return t;
    if (anchorKey && productKey(row) === anchorKey) {
      t.sameProductCount += 1;
      t.sameProductQuantity += q;
    } else if (anchorMaterial && materialKey(row) === anchorMaterial) {
      t.sameMaterialCount += 1;
      t.sameMaterialQuantity += q;
    }
    return t;
  }, { sameProductCount: 0, sameProductQuantity: 0, sameMaterialCount: 0, sameMaterialQuantity: 0 });
}

function buildMachineChoice(ctx, assignments, row, quantity, remainingRows, machine, options = {}) {
  const q = Number.isFinite(Number(quantity)) ? Math.max(0, Number(quantity)) : 0;
  if (q <= 0 || !machine.equipment) return null;

  const record = productRecord(ctx, row);
  const estimatedTime = calcProductionTime(ctx, record, q, machine.equipment);
  const timing = findAvailableWindow(ctx, assignments, machine.equipment, estimatedTime.totalSeconds / 60, {
    earliestStartMinutes: options.earliestStartMinutes,
  });
  const endMinutes = roundToInterval(timing.endTime);
  return {
    ...machine,
    startMinutes: timing.startTime,
    endMinutes,
    estimatedTime,
    boxes: calcBoxes(ctx, record, q, machine.equipment),
    affinityRank: affinityRank(ctx, assignments, machine.equipment, row, timing.startTime),
    slackMinutes: ctx.scheduleUntilMinutes - endMinutes,
    scheduledQuantity: q,
    ...batchPotential(ctx, remainingRows, row, machine.equipment),
  };
}

function compareMachineChoices(l = {}, r = {}) {
  if (l.groupingTier !== r.groupingTier) return l.groupingTier - r.groupingTier;
  if (r.sameProductCount !== l.sameProductCount) return r.sameProductCount - l.sameProductCount;
  if (r.sameProductQuantity !== l.sameProductQuantity) return r.sameProductQuantity - l.sameProductQuantity;
  if (r.sameMaterialCount !== l.sameMaterialCount) return r.sameMaterialCount - l.sameMaterialCount;
  if (r.sameMaterialQuantity !== l.sameMaterialQuantity) return r.sameMaterialQuantity - l.sameMaterialQuantity;
  if (l.startMinutes !== r.startMinutes) return l.startMinutes - r.startMinutes;
  if (l.endMinutes !== r.endMinutes) return l.endMinutes - r.endMinutes;
  if (l.preferred !== r.preferred) return l.preferred ? -1 : 1;
  if (l.affinityRank !== r.affinityRank) return l.affinityRank - r.affinityRank;
  if (l.priority !== r.priority) return l.priority - r.priority;
  if (r.slackMinutes !== l.slackMinutes) return r.slackMinutes - l.slackMinutes;
  return l.order - r.order;
}

function applyGrouping(choices) {
  const earliest = choices.reduce((m, c) => Math.min(m, c.startMinutes), Number.POSITIVE_INFINITY);
  const limit = INTERVAL * 2;
  return choices.map((choice) => {
    const delay = Number.isFinite(earliest) ? Math.max(0, choice.startMinutes - earliest) : 0;
    return { ...choice, startDelayMinutes: delay, groupingTier: delay <= limit ? groupingTier(choice.affinityRank) : 2 };
  });
}

function machineChoicesForRow(ctx, assignments, row, remainingRows) {
  const quantity = Number(row.shortfallQuantity || 0);
  if (quantity <= 0) return [];
  const choices = candidateMachines(ctx, row)
    .map((machine) => buildMachineChoice(ctx, assignments, row, quantity, remainingRows, machine))
    .filter((choice) => choice && choice.endMinutes <= ctx.scheduleUntilMinutes);
  return applyGrouping(choices).sort(compareMachineChoices);
}

function partialMachineChoicesForRow(ctx, assignments, row, remainingRows) {
  const quantity = Number(row.shortfallQuantity || 0);
  if (quantity <= 0) return [];
  const record = productRecord(ctx, row);

  const choices = candidateMachines(ctx, row).map((machine) => {
    const startTiming = findAvailableWindow(ctx, assignments, machine.equipment, 0, {});
    const start = startTiming.startTime;
    if (!Number.isFinite(start) || start >= ctx.scheduleUntilMinutes) return null;

    const next = occupiedWindows(ctx, assignments, machine.equipment).find((w) => w.startMinutes > start);
    const windowEnd = Math.min(ctx.scheduleUntilMinutes, next ? next.startMinutes : ctx.scheduleUntilMinutes);
    const minutes = availableProductionMinutes(ctx, start, windowEnd, machine.equipment);
    if (minutes <= 0) return null;

    const secondsPerPiece = resolveCycleSeconds(ctx, record, machine.equipment);
    if (!Number.isFinite(secondsPerPiece) || secondsPerPiece <= 0) return null;

    const partialQuantity = Math.min(quantity, Math.floor((minutes * 60) / secondsPerPiece));
    if (partialQuantity <= 0) return null;

    const choice = buildMachineChoice(ctx, assignments, row, partialQuantity, remainingRows, machine, { earliestStartMinutes: start });
    if (!choice || choice.endMinutes > ctx.scheduleUntilMinutes) return null;
    return { ...choice, partialQuantity, availableProductionMinutes: minutes };
  }).filter(Boolean);

  return applyGrouping(choices).sort((l, r) => (
    r.partialQuantity - l.partialQuantity || l.startMinutes - r.startMinutes || compareMachineChoices(l, r)
  ));
}

function buildAssignment(ctx, row, choice, quantityOverride = null) {
  const record = productRecord(ctx, row);
  const quantity = quantityOverride !== null && Number.isFinite(Number(quantityOverride)) ? Math.max(0, Number(quantityOverride)) : Number(row.shortfallQuantity || 0);
  return {
    ...record,
    背番号: row.背番号,
    品番: row.品番,
    品名: row.品名,
    モデル: row.モデル,
    quantity,
    equipment: choice.equipment,
    startTime: minutesToTime(choice.startMinutes),
    boxes: choice.boxes,
    estimatedTime: choice.estimatedTime,
    color: ctx.productColors?.[row.背番号] || "#0F766E",
    previewSource: "priority",
    requestNumber: row.requestNumber,
    requestNumberLabel: row.requestNumberLabel,
    lineNumber: row.lineNumber,
    requestStatus: row.requestStatus,
    sourceRowId: row.id,
    sourceRowIds: row.sourceRowIds,
    groupedRequestNumbers: row.groupedRequestNumbers,
    previewEndTime: minutesToTime(choice.endMinutes),
    usedPreferredMachine: choice.preferred === true,
  };
}

// ─── Simulation ─────────────────────────────────────────────────────────────

function makeException(ctx, row, reason, quantity) {
  const machines = candidateMachines(ctx, row);
  const exception = {
    id: row.id,
    reason,
    requestNumber: row.requestNumber,
    lineNumber: row.lineNumber,
    背番号: row.背番号,
    品番: row.品番,
    shortfallQuantity: quantity,
  };
  if (reason === "time-limit") {
    exception.scheduleUntilTime = ctx.scheduleUntilTime;
    exception.candidateEquipment = machines.map((m) => (m.preferred ? `${m.equipment}*` : m.equipment));
  } else if (machines.length === 0) {
    exception.reason = row.capabilityStatus || "unmapped";
  }
  return exception;
}

export function buildSimulation(ctx, priorityRows = []) {
  const assignments = [];
  const exceptions = [];
  const pending = buildSchedulingRows(priorityRows);
  let scheduled = 0;

  while (pending.length > 0) {
    const row = pending.shift();
    const shortage = Number(row.shortfallQuantity || 0);
    if (shortage <= 0) continue;

    if (candidateMachines(ctx, row).length === 0) {
      exceptions.push(makeException(ctx, row, row.capabilityStatus || "unmapped", shortage));
      continue;
    }

    const fit = machineChoicesForRow(ctx, assignments, row, pending)[0];
    if (fit) {
      assignments.push(buildAssignment(ctx, row, fit));
      scheduled += shortage;
      continue;
    }

    const partial = partialMachineChoicesForRow(ctx, assignments, row, pending)[0];
    const partialQuantity = Number(partial?.partialQuantity || 0);
    if (!partial || partialQuantity <= 0) {
      exceptions.push(makeException(ctx, row, "time-limit", shortage));
      continue;
    }

    assignments.push(buildAssignment(ctx, row, partial, partialQuantity));
    scheduled += partialQuantity;
    const remaining = shortage - partialQuantity;
    if (remaining > 0) pending.unshift({ ...row, shortfallQuantity: remaining });
  }

  return finalizeSimulation(ctx, assignments, exceptions, scheduled);
}

function finalizeSimulation(ctx, assignments, exceptions, scheduledQuantity) {
  const equipmentList = Array.from(new Set(
    assignments
      .filter((a) => timeToMinutes(a.startTime || PLANNER_CONFIG.workStartTime) < ctx.scheduleUntilMinutes)
      .map((a) => String(a.equipment || "").trim())
      .filter(Boolean),
  )).sort((l, r) => l.localeCompare(r));
  const timeLimit = exceptions.filter((e) => e.reason === "time-limit");

  return {
    assignments,
    equipmentList,
    exceptions,
    scheduleUntilTime: ctx.scheduleUntilTime,
    scheduleUntilMinutes: ctx.scheduleUntilMinutes,
    scheduledShortfallQuantity: scheduledQuantity,
    unscheduledShortfallQuantity: exceptions.reduce((s, e) => s + Number(e.shortfallQuantity || 0), 0),
    timeLimitMissedQuantity: timeLimit.reduce((s, e) => s + Number(e.shortfallQuantity || 0), 0),
    timeLimitExceptionCount: timeLimit.length,
    otherExceptionCount: exceptions.length - timeLimit.length,
  };
}

// ─── Draft assignments ──────────────────────────────────────────────────────

export function cloneAssignment(ctx, assignment = {}, index = 0) {
  const sourceRowIds = Array.isArray(assignment.sourceRowIds) ? [...assignment.sourceRowIds] : [];
  const groupedRequestNumbers = Array.isArray(assignment.groupedRequestNumbers) ? [...assignment.groupedRequestNumbers] : [];
  const sourceId = String(
    assignment.draftId || assignment.sourceRowId || sourceRowIds[0] || assignment.requestNumber
    || assignment.背番号 || assignment.品番 || `preview-${index}`,
  ).trim();
  const equipment = String(assignment.equipment || "").trim() || "preview";
  const startTime = String(assignment.startTime || PLANNER_CONFIG.workStartTime).trim();
  const record = productRecord(ctx, { ...assignment, equipment });
  const capacity = resolveBoxQuantity(ctx, record, equipment);
  const parsedQuantity = Number(assignment.quantity);
  const parsedBoxes = Number(assignment.boxes);
  const fromBoxes = parsedBoxes > 0 && capacity > 0 ? parsedBoxes * capacity : 0;
  const quantity = parsedQuantity > 0 ? parsedQuantity : fromBoxes;
  const boxes = parsedBoxes > 0 ? parsedBoxes : (quantity > 0 && capacity > 0 ? Math.ceil(quantity / capacity) : null);
  const estimatedTime = assignmentEstimatedTime(ctx, { ...assignment, ...record, equipment, quantity });
  const draftMax = Number.isFinite(Number(assignment.draftMaxQuantity)) ? Math.max(0, Number(assignment.draftMaxQuantity)) : quantity;

  return {
    ...assignment,
    ...record,
    equipment,
    startTime,
    previewEndTime: String(assignment.previewEndTime || "").trim(),
    quantity,
    boxes,
    draftMaxQuantity: draftMax,
    draftId: assignment.draftId || `${sourceId}::${equipment}::${startTime}::${index}`,
    sourceRowIds,
    groupedRequestNumbers,
    estimatedTime,
  };
}

export function normalizeAssignments(ctx, assignments = []) {
  return assignments
    .map((assignment, index) => cloneAssignment(ctx, assignment, index))
    .sort((l, r) => {
      const le = String(l.equipment || "").trim();
      const re = String(r.equipment || "").trim();
      if (le !== re) return le.localeCompare(re);
      const ls = timeToMinutes(l.startTime || PLANNER_CONFIG.workStartTime);
      const rs = timeToMinutes(r.startTime || PLANNER_CONFIG.workStartTime);
      if (ls !== rs) return ls - rs;
      return String(l.draftId || "").localeCompare(String(r.draftId || ""));
    });
}

// Same block on another machine: cycle time / box size can differ per machine.
function retarget(ctx, assignment = {}, equipment = "") {
  const name = String(equipment || "").trim();
  if (!name || name === String(assignment.equipment || "").trim()) return assignment;
  const record = productRecord(ctx, { ...assignment, equipment: name });
  const quantity = Math.max(0, Number(assignment.quantity || 0));
  return {
    ...assignment,
    equipment: name,
    previewEndTime: "",
    boxes: calcBoxes(ctx, record, quantity, name),
    estimatedTime: calcProductionTime(ctx, record, quantity, name),
  };
}

export const draftIdOf = (assignment = {}) => String(assignment.draftId || "").trim();

export function buildBasisRows(priorityRows = []) {
  return (Array.isArray(priorityRows) ? priorityRows : []).map((row = {}) => {
    const id = String(row.id || "").trim();
    const requestId = String(row.requestId || "").trim();
    const requestNumber = String(row.requestNumber || "").trim();
    const sebanggo = String(row.背番号 || "").trim();
    const hinban = String(row.品番 || "").trim();
    if (!id && !requestNumber && !requestId && !sebanggo && !hinban) return null;
    return {
      id: id || null,
      requestId: requestId || null,
      requestNumber,
      lineNumber: Number.isFinite(Number(row.lineNumber)) ? Number(row.lineNumber) : null,
      背番号: sebanggo,
      品番: hinban,
      shortfallQuantity: Number(row.shortfallQuantity || 0),
    };
  }).filter(Boolean);
}

// Recompute exceptions / totals after the draft assignments were edited.
export function buildDraftSimulation(ctx, priorityRows, basisRows, draftAssignments = []) {
  const assignments = normalizeAssignments(ctx, draftAssignments).filter((a) => Number(a.quantity || 0) > 0);
  const rowMap = new Map((priorityRows || []).map((row) => [String(row?.id || "").trim(), row]));
  const remaining = new Map();
  (basisRows || []).forEach((row) => {
    const id = String(row.id || "").trim();
    if (id) remaining.set(id, Math.max(0, Number(row.shortfallQuantity || 0)));
  });

  assignments.forEach((assignment) => {
    let left = Math.max(0, Number(assignment.quantity || 0));
    sourceRowIdsOf(assignment).forEach((id) => {
      if (left <= 0) return;
      const current = Math.max(0, Number(remaining.get(id) || 0));
      if (current <= 0) return;
      const used = Math.min(left, current);
      remaining.set(id, current - used);
      left -= used;
    });
  });

  const exceptions = [];
  (basisRows || []).forEach((row) => {
    const id = String(row.id || "").trim();
    const shortfall = Math.max(0, Number(remaining.get(id) || 0));
    if (shortfall <= 0) return;
    const priorityRow = rowMap.get(id) || null;
    const machines = priorityRow ? candidateMachines(ctx, priorityRow) : [];
    const capabilityIssue = !!(priorityRow && (priorityRow.capabilityStatus !== "mapped" || machines.length === 0));
    const reason = capabilityIssue ? (priorityRow.capabilityStatus || "unmapped") : "time-limit";
    const exception = {
      id: id || null,
      reason,
      requestNumber: String(row.requestNumber || "").trim(),
      lineNumber: Number.isFinite(Number(row.lineNumber)) ? Number(row.lineNumber) : null,
      背番号: String(row.背番号 || "").trim(),
      品番: String(row.品番 || "").trim(),
      shortfallQuantity: shortfall,
    };
    if (reason === "time-limit") {
      exception.scheduleUntilTime = ctx.scheduleUntilTime;
      exception.candidateEquipment = machines.map((m) => (m.preferred ? `${m.equipment}*` : m.equipment));
    }
    exceptions.push(exception);
  });

  const scheduled = assignments.reduce((s, a) => s + Math.max(0, Number(a.quantity || 0)), 0);
  return finalizeSimulation(ctx, assignments, exceptions, scheduled);
}

function sourceRowIdsOf(assignment = {}) {
  const ids = Array.isArray(assignment.sourceRowIds)
    ? assignment.sourceRowIds.map((v) => String(v || "").trim()).filter(Boolean)
    : [];
  if (ids.length > 0) return ids;
  const single = String(assignment.sourceRowId || "").trim();
  return single ? [single] : [];
}

// ─── Box quantity editing ───────────────────────────────────────────────────

export function assignmentCapacity(ctx, assignment = {}) {
  return resolveBoxQuantity(ctx, productRecord(ctx, assignment), assignment.equipment);
}

export function assignmentBoxCount(ctx, assignment = {}) {
  const quantity = Math.max(0, Number(assignment.quantity || 0));
  return quantity <= 0 ? 0 : calcBoxes(ctx, productRecord(ctx, assignment), quantity, assignment.equipment);
}

export function assignmentLimitQuantity(assignment = {}) {
  return Math.max(0, Number.isFinite(Number(assignment.draftMaxQuantity)) ? Number(assignment.draftMaxQuantity) : Number(assignment.quantity || 0));
}

export function assignmentMaxBoxes(ctx, assignment = {}) {
  const capacity = assignmentCapacity(ctx, assignment);
  const limit = assignmentLimitQuantity(assignment);
  return capacity > 0 && limit > 0 ? Math.ceil(limit / capacity) : 0;
}

function quantityForBoxes(ctx, assignment, targetBoxes) {
  const boxes = Math.max(0, Number(targetBoxes || 0));
  if (boxes <= 0) return 0;
  const capacity = assignmentCapacity(ctx, assignment);
  const limit = assignmentLimitQuantity(assignment);
  if (capacity <= 0 || limit <= 0) return Math.max(0, Number(assignment.quantity || 0));
  return boxes >= Math.ceil(limit / capacity) ? limit : Math.min(limit, boxes * capacity);
}

// ─── Lane helpers (repack / placement / move / swap) ────────────────────────

function laneAssignments(assignments, equipment) {
  const name = String(equipment || "").trim();
  return assignments
    .filter((a) => String(a.equipment || "").trim() === name)
    .sort((l, r) => (
      timeToMinutes(l.startTime || PLANNER_CONFIG.workStartTime) - timeToMinutes(r.startTime || PLANNER_CONFIG.workStartTime)
      || draftIdOf(l).localeCompare(draftIdOf(r))
    ));
}

function repackLane(ctx, assignments, equipment, orderedLane, earliestAffectedIndex = 0) {
  const name = String(equipment || "").trim();
  if (!name) return { ok: false, messageKey: "selectValidLane" };

  const current = laneAssignments(assignments, name);
  const affectedIndex = Math.max(0, Math.min(
    Number.isFinite(Number(earliestAffectedIndex)) ? Number(earliestAffectedIndex) : 0,
    orderedLane.length,
  ));
  const prefix = orderedLane.slice(0, affectedIndex).map((a) => ({ ...a, equipment: name }));
  const suffix = orderedLane.slice(affectedIndex);
  const anchor = current[affectedIndex] || null;
  const lastFixed = prefix[prefix.length - 1] || null;
  const anchorMinutes = anchor
    ? timeToMinutes(anchor.startTime || PLANNER_CONFIG.workStartTime)
    : lastFixed ? assignmentEndMinutes(ctx, lastFixed) : timeToMinutes(PLANNER_CONFIG.workStartTime);

  let earliest = Number.isFinite(anchorMinutes) ? anchorMinutes : timeToMinutes(PLANNER_CONFIG.workStartTime);
  let changed = false;
  const base = assignments.filter((a) => String(a.equipment || "").trim() !== name);
  const placed = [...prefix];

  for (const item of suffix) {
    const next = { ...item, equipment: name };
    const duration = Number(next?.estimatedTime?.totalSeconds || 0) / 60;
    const timing = findAvailableWindow(ctx, [...base, ...placed], name, duration, { earliestStartMinutes: earliest });
    const end = roundToInterval(timing.endTime);
    if (end > ctx.scheduleUntilMinutes) {
      return { ok: false, messageKey: "swapPastLimit", block: blockLabel(next), time: ctx.scheduleUntilTime };
    }
    const start = minutesToTime(timing.startTime);
    if (start !== String(next.startTime || "").trim()) changed = true;
    placed.push({ ...next, startTime: start, previewEndTime: minutesToTime(end) });
    earliest = end;
  }

  return { ok: true, assignments: placed, startTimesChanged: changed };
}

function mergeLanes(ctx, assignments, byEquipment) {
  const replaced = new Set(Object.keys(byEquipment));
  const map = new Map();
  Object.values(byEquipment).forEach((lane) => (lane || []).forEach((a) => map.set(draftIdOf(a), a)));
  const untouched = assignments.filter((a) => !replaced.has(String(a.equipment || "").trim()));
  return normalizeAssignments(ctx, [...untouched, ...map.values()]);
}

export const blockLabel = (item = {}, fallback = "") => String(item?.背番号 || item?.品番 || "").trim() || fallback;

function isBreakAt(ctx, equipment, minutes) {
  return !!isBreakAtSlot(minutes, equipment, ctx.breaks);
}

export function canUseEquipment(ctx, equipment = "") {
  const name = String(equipment || "").trim();
  // Admin may move a block to any working machine; only broken-down ones are refused.
  return !!name && !isEquipmentUnavailable(name, ctx.unavailableEquipment);
}

export function getPlacement(ctx, moving = {}, targetEquipment = "", targetTime = "") {
  const equipment = String(targetEquipment || "").trim();
  if (!equipment) return { ok: false, messageKey: "selectValidLane" };
  if (!canUseEquipment(ctx, equipment)) return { ok: false, messageKey: "ineligible", block: blockLabel(moving), equipment };

  const start = timeToMinutes(targetTime || moving.startTime || PLANNER_CONFIG.workStartTime);
  if (!Number.isFinite(start)) return { ok: false, messageKey: "invalidSlot" };
  if (isBreakAt(ctx, equipment, start)) return { ok: false, messageKey: "breakSlot" };

  const duration = Number(moving.estimatedTime?.totalSeconds || 0) / 60;
  const timing = findNextAvailableTime(start, duration, equipment, ctx.breaks);
  if (timing.startTime !== start) return { ok: false, messageKey: "invalidStartTile" };

  const end = roundToInterval(timing.endTime);
  if (end > ctx.scheduleUntilMinutes) return { ok: false, messageKey: "movePastLimit", time: ctx.scheduleUntilTime };
  return { ok: true, equipment, startMinutes: start, endMinutes: end };
}

export function assignmentAtSlot(ctx, assignments = [], equipment = "", time = "", excludedDraftId = "") {
  const name = String(equipment || "").trim();
  const slot = timeToMinutes(time || "");
  if (!name || !Number.isFinite(slot)) return null;
  return assignments.find((a) => {
    if (String(a.equipment || "").trim() !== name) return false;
    if (excludedDraftId && draftIdOf(a) === excludedDraftId) return false;
    const start = timeToMinutes(a.startTime || PLANNER_CONFIG.workStartTime);
    const end = roundToInterval(timeToMinutes(a.previewEndTime || a.startTime || PLANNER_CONFIG.workStartTime));
    return slot >= start && slot < end;
  }) || null;
}

export function evaluateMove(ctx, assignments, moving, targetEquipment, targetTime) {
  const placement = getPlacement(ctx, moving, targetEquipment, targetTime);
  if (!placement.ok) return placement;
  const windows = occupiedWindows(ctx, assignments, placement.equipment);
  const overlaps = windows.some((w) => placement.startMinutes < w.endMinutes && placement.endMinutes > w.startMinutes);
  return overlaps ? { ok: false, messageKey: "overlap" } : placement;
}

export function evaluateSwap(ctx, assignments, moving, target) {
  const movingEq = String(moving.equipment || "").trim();
  const targetEq = String(target.equipment || "").trim();
  const movingId = draftIdOf(moving);
  const targetId = draftIdOf(target);
  if (!movingId || !targetId || movingId === targetId) return { ok: false, messageKey: "chooseAnother" };
  if (!movingEq || !targetEq) return { ok: false, messageKey: "selectValidLane" };
  if (!canUseEquipment(ctx, targetEq)) return { ok: false, messageKey: "ineligible", block: blockLabel(moving), equipment: targetEq };
  if (!canUseEquipment(ctx, movingEq)) return { ok: false, messageKey: "ineligible", block: blockLabel(target), equipment: movingEq };

  const all = normalizeAssignments(ctx, assignments);
  const movingLane = laneAssignments(all, movingEq);
  const targetLane = laneAssignments(all, targetEq);
  const mi = movingLane.findIndex((a) => draftIdOf(a) === movingId);
  const ti = targetLane.findIndex((a) => draftIdOf(a) === targetId);
  if (mi === -1 || ti === -1) return { ok: false, messageKey: "swapNotFound" };

  if (movingEq === targetEq) {
    const swapped = [...movingLane];
    [swapped[mi], swapped[ti]] = [{ ...swapped[ti], equipment: movingEq }, { ...swapped[mi], equipment: movingEq }];
    const repacked = repackLane(ctx, all, movingEq, swapped, Math.min(mi, ti));
    if (!repacked.ok) return repacked;
    return { ok: true, assignments: mergeLanes(ctx, all, { [movingEq]: repacked.assignments }), startTimesChanged: repacked.startTimesChanged };
  }

  const nextMovingLane = [...movingLane];
  nextMovingLane[mi] = retarget(ctx, target, movingEq);
  const nextTargetLane = [...targetLane];
  nextTargetLane[ti] = retarget(ctx, moving, targetEq);

  const repackedMoving = repackLane(ctx, all, movingEq, nextMovingLane, mi);
  if (!repackedMoving.ok) return repackedMoving;
  const sourceAdjusted = mergeLanes(ctx, all, { [movingEq]: repackedMoving.assignments });

  const repackedTarget = repackLane(ctx, sourceAdjusted, targetEq, nextTargetLane, ti);
  if (!repackedTarget.ok) return repackedTarget;

  return {
    ok: true,
    assignments: mergeLanes(ctx, sourceAdjusted, { [targetEq]: repackedTarget.assignments }),
    startTimesChanged: repackedMoving.startTimesChanged || repackedTarget.startTimesChanged,
  };
}

// Drop a block on a tile: swap if the tile is occupied, otherwise move.
export function applyDrop(ctx, assignments, draggedId, targetEquipment, targetTime) {
  const all = normalizeAssignments(ctx, assignments);
  const index = all.findIndex((a) => draftIdOf(a) === draggedId);
  if (index === -1) return { ok: false, messageKey: "swapNotFound" };

  const moving = { ...all[index] };
  const others = all.filter((_, i) => i !== index);
  const occupant = assignmentAtSlot(ctx, others, targetEquipment, targetTime, draggedId);

  if (occupant) {
    const swap = evaluateSwap(ctx, all, moving, occupant);
    if (!swap.ok) return swap;
    return { ok: true, kind: "swap", assignments: normalizeAssignments(ctx, swap.assignments), moving, target: occupant, startTimesChanged: swap.startTimesChanged };
  }

  const retargeted = retarget(ctx, moving, targetEquipment);
  const move = evaluateMove(ctx, others, retargeted, targetEquipment, targetTime);
  if (!move.ok) return move;
  const placed = {
    ...retargeted,
    startTime: minutesToTime(move.startMinutes),
    previewEndTime: minutesToTime(move.endMinutes),
  };
  return { ok: true, kind: "move", assignments: normalizeAssignments(ctx, [...others, placed]), moving: placed };
}

// Change box count of one block; lane after it is repacked.
export function adjustBoxes(ctx, assignments, draftId, delta) {
  const all = normalizeAssignments(ctx, assignments);
  const target = all.find((a) => draftIdOf(a) === draftId);
  if (!target) return { ok: false, messageKey: "swapNotFound" };

  const current = assignmentBoxCount(ctx, target);
  const max = assignmentMaxBoxes(ctx, target);
  const nextBoxes = Math.max(0, Math.min(max, current + Number(delta || 0)));
  if (nextBoxes === current) return { ok: true, unchanged: true, assignments: all };

  const nextQuantity = quantityForBoxes(ctx, target, nextBoxes);
  const lane = laneAssignments(all, target.equipment);
  const laneIndex = lane.findIndex((a) => draftIdOf(a) === draftId);
  if (laneIndex === -1) return { ok: false, messageKey: "swapNotFound" };

  const record = productRecord(ctx, target);
  const nextAssignment = nextQuantity > 0
    ? {
      ...target,
      quantity: nextQuantity,
      boxes: calcBoxes(ctx, record, nextQuantity, target.equipment),
      estimatedTime: calcProductionTime(ctx, record, nextQuantity, target.equipment),
    }
    : null;
  const nextLane = nextAssignment
    ? lane.map((a, i) => (i === laneIndex ? nextAssignment : a))
    : lane.filter((a) => draftIdOf(a) !== draftId);

  const repacked = repackLane(ctx, all, target.equipment, nextLane, laneIndex);
  if (!repacked.ok) return repacked;
  return { ok: true, assignments: mergeLanes(ctx, all, { [target.equipment]: repacked.assignments }), removed: nextQuantity <= 0 };
}

// ─── Insert a time-limit exception into the draft ───────────────────────────

export function buildInsertOption(ctx, priorityRowMap, assignments, exception, targetEquipment, targetTime) {
  const equipment = String(targetEquipment || "").trim();
  const time = String(targetTime || "").trim();
  const row = priorityRowMap.get(String(exception?.id || "").trim());
  if (!equipment || !time || !row) return null;
  if (!candidateMachines(ctx, row).some((m) => m.equipment === equipment)) return null;
  if (assignmentAtSlot(ctx, assignments, equipment, time)) return null;

  const start = timeToMinutes(time);
  if (!Number.isFinite(start) || isBreakAt(ctx, equipment, start)) return null;

  const limit = Math.max(0, Number(exception.shortfallQuantity || row.shortfallQuantity || 0));
  if (limit <= 0) return null;

  const record = productRecord(ctx, { ...row, equipment });
  const secondsPerPiece = resolveCycleSeconds(ctx, record, equipment);
  if (!Number.isFinite(secondsPerPiece) || secondsPerPiece <= 0) return null;

  const next = occupiedWindows(ctx, assignments, equipment).find((w) => w.startMinutes > start);
  const windowEnd = Math.min(ctx.scheduleUntilMinutes, next ? next.startMinutes : ctx.scheduleUntilMinutes);
  const minutes = availableProductionMinutes(ctx, start, windowEnd, equipment);
  if (minutes <= 0) return null;

  const quantity = Math.min(limit, Math.floor((minutes * 60) / secondsPerPiece));
  if (quantity <= 0) return null;

  const boxes = calcBoxes(ctx, record, quantity, equipment);
  const estimatedTime = calcProductionTime(ctx, record, quantity, equipment);
  if (!(estimatedTime.totalSeconds > 0)) return null;

  const placement = getPlacement(ctx, { ...row, ...record, equipment, quantity, boxes, estimatedTime }, equipment, time);
  if (!placement.ok) return null;

  return {
    exception,
    priorityRow: row,
    equipment,
    startTime: time,
    endTime: minutesToTime(placement.endMinutes),
    quantity,
    boxes,
    remainingQuantity: Math.max(0, limit - quantity),
    isPartial: quantity < limit,
    estimatedTime,
  };
}

export function getInsertOptions(ctx, priorityRowMap, assignments, exceptions, equipment, time) {
  return exceptions
    .filter((e) => e.reason === "time-limit")
    .map((e) => buildInsertOption(ctx, priorityRowMap, assignments, e, equipment, time))
    .filter(Boolean)
    .sort((l, r) => {
      const lr = Number(l.priorityRow?.priorityRank || l.priorityRow?.queueOrder || Number.MAX_SAFE_INTEGER);
      const rr = Number(r.priorityRow?.priorityRank || r.priorityRow?.queueOrder || Number.MAX_SAFE_INTEGER);
      if (lr !== rr) return lr - rr;
      const ll = Number(l.priorityRow?.lineNumber || Number.MAX_SAFE_INTEGER);
      const rl = Number(r.priorityRow?.lineNumber || Number.MAX_SAFE_INTEGER);
      if (ll !== rl) return ll - rl;
      return String(l.priorityRow?.requestNumber || "").localeCompare(String(r.priorityRow?.requestNumber || ""));
    });
}

export function insertException(ctx, priorityRowMap, assignments, exception, equipment, time) {
  const all = normalizeAssignments(ctx, assignments);
  const option = buildInsertOption(ctx, priorityRowMap, all, exception, equipment, time);
  if (!option) return { ok: false, messageKey: "insertFailed" };

  const row = option.priorityRow;
  const record = productRecord(ctx, { ...row, equipment: option.equipment });
  const sourceRowId = String(row.id || exception.id || "").trim();
  const requestNumber = String(row.requestNumber || exception.requestNumber || "").trim();
  const grouped = Array.isArray(row.groupedRequestNumbers) && row.groupedRequestNumbers.length > 0
    ? row.groupedRequestNumbers.map((v) => String(v || "").trim()).filter(Boolean)
    : (requestNumber ? [requestNumber] : []);

  const assignment = {
    ...record,
    背番号: row.背番号,
    品番: row.品番,
    品名: row.品名,
    モデル: row.モデル,
    quantity: option.quantity,
    draftMaxQuantity: option.quantity,
    equipment: option.equipment,
    startTime: option.startTime,
    boxes: option.boxes,
    estimatedTime: { ...option.estimatedTime },
    color: ctx.productColors?.[row.背番号] || "#0F766E",
    previewSource: "priority",
    requestNumber,
    requestNumberLabel: String(row.requestNumberLabel || requestNumber).trim(),
    lineNumber: Number.isFinite(Number(row.lineNumber)) ? Number(row.lineNumber) : null,
    requestStatus: String(row.requestStatus || "").trim(),
    sourceRowId: sourceRowId || null,
    sourceRowIds: sourceRowId ? [sourceRowId] : [],
    groupedRequestNumbers: grouped,
    previewEndTime: option.endTime,
    usedPreferredMachine: false,
    draftId: `${sourceRowId || requestNumber || blockLabel(row, "insert")}::${option.equipment}::${option.startTime}::insert`,
  };

  const move = evaluateMove(ctx, all, assignment, option.equipment, option.startTime);
  if (!move.ok) return move;
  assignment.startTime = minutesToTime(move.startMinutes);
  assignment.previewEndTime = minutesToTime(move.endMinutes);

  return { ok: true, assignments: normalizeAssignments(ctx, [...all, assignment]), assignment };
}

// ─── Misc for UI ────────────────────────────────────────────────────────────

export function getPreviewTimeSlots(scheduleUntilMinutes) {
  const slots = [];
  for (let m = timeToMinutes(PLANNER_CONFIG.workStartTime); m < scheduleUntilMinutes; m += INTERVAL) slots.push(minutesToTime(m));
  return slots;
}

export function priorityRowMapOf(priorityRows = []) {
  return new Map((priorityRows || []).map((row) => [String(row?.id || "").trim(), row]).filter(([id]) => id));
}

// ─── Export (copy-to-clipboard JSON) ────────────────────────────────────────

export function buildScheduleExport(ctx, preview = {}, simulation, mode = "auto", meta = {}) {
  if (!simulation) return null;
  const assignments = normalizeAssignments(ctx, simulation.assignments || []).map((assignment, index) => ({
    index: index + 1,
    draftId: draftIdOf(assignment) || null,
    equipment: String(assignment.equipment || "").trim(),
    startTime: String(assignment.startTime || "").trim(),
    endTime: minutesToTime(assignmentEndMinutes(ctx, assignment)),
    requestNumber: String(assignment.requestNumber || "").trim(),
    requestNumberLabel: String(assignment.requestNumberLabel || assignment.requestNumber || "").trim(),
    背番号: String(assignment.背番号 || "").trim(),
    品番: String(assignment.品番 || "").trim(),
    品名: String(assignment.品名 || "").trim(),
    モデル: String(assignment.モデル || "").trim(),
    quantity: Number(assignment.quantity || 0),
    boxes: assignment.boxes === null || assignment.boxes === undefined ? null : Number(assignment.boxes),
    previewSource: String(assignment.previewSource || "").trim(),
    usedPreferredMachine: assignment.usedPreferredMachine === true,
    groupedRequestNumbers: Array.isArray(assignment.groupedRequestNumbers) ? assignment.groupedRequestNumbers : [],
    sourceRowIds: Array.isArray(assignment.sourceRowIds) ? assignment.sourceRowIds : [],
    eligibleMachines: (ctx.rowByKey.get(productKey(assignment))?.eligibleMachines || [])
      .map((machine) => String(machine?.equipment || machine?.設備 || "").trim())
      .filter(Boolean),
    estimatedTime: assignment.estimatedTime
      ? {
        totalSeconds: Number(assignment.estimatedTime.totalSeconds || 0),
        formattedTime: String(assignment.estimatedTime.formattedTime || "").trim(),
        cyclesNeeded: Number.isFinite(Number(assignment.estimatedTime.cyclesNeeded)) ? Number(assignment.estimatedTime.cyclesNeeded) : null,
      }
      : null,
  }));

  const equipmentList = Array.from(new Set(assignments.map((a) => a.equipment).filter(Boolean))).sort((l, r) => l.localeCompare(r));

  return {
    exportType: "production-planner-preview-schedule",
    mode: mode === "draft" ? "draft" : "auto",
    draftSource: meta.draftSource || null,
    factory: String(preview.factory || meta.factory || "").trim(),
    targetDate: String(preview.targetDate || meta.date || "").trim(),
    generatedAt: preview.generatedAt || null,
    scheduleUntilTime: ctx.scheduleUntilTime,
    priorityRowCount: Number(preview.summary?.priorityRowCount || 0),
    totalShortfallQuantity: Number(preview.summary?.totalShortfallQuantity || 0),
    assignmentCount: assignments.length,
    equipmentList,
    exceptions: Array.isArray(simulation.exceptions) ? simulation.exceptions : [],
    assignments,
    scheduleByMachine: Object.fromEntries(equipmentList.map((eq) => [eq, assignments.filter((a) => a.equipment === eq)])),
  };
}

export async function copyTextToClipboard(text = "") {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn("Clipboard API copy failed, falling back to execCommand.", error);
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.cssText = "position:fixed;top:-9999px;left:-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    console.warn("execCommand copy failed.", error);
  }
  document.body.removeChild(textarea);
  return copied;
}
