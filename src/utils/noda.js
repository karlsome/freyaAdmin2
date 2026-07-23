export const NODA_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const NODA_EDIT_ROLES = ["admin", "課長", "係長"];

export const EMPTY_NODA_STATS = {
  all: 0,
  pending: 0,
  "in-progress": 0,
  completed: 0,
  "past-deadline": 0,
  "partial-inventory": 0,
  cancelled: 0,
};

export const NODA_STATUS_OPTIONS = [
  { value: "", labelKey: "nodaStatusAllStatuses" },
  { value: "pending", labelKey: "pending" },
  { value: "in-progress", labelKey: "nodaStatusInProgress" },
  { value: "completed", labelKey: "nodaStatusCompleted" },
  { value: "past-deadline", labelKey: "nodaStatusDeadlinePassed" },
  { value: "partial-inventory", labelKey: "nodaStatusPartialInventory" },
  { value: "cancelled", labelKey: "nodaStatusCancelled" },
];

export const NODA_STATUS_CARDS = [
  { key: "all", labelKey: "all", icon: "list_alt", accent: "bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200" },
  { key: "pending", labelKey: "pending", icon: "schedule", accent: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { key: "in-progress", labelKey: "nodaStatusInProgress", icon: "play_circle", accent: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { key: "completed", labelKey: "nodaStatusCompleted", icon: "task_alt", accent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { key: "past-deadline", labelKey: "nodaStatusDeadlinePassed", icon: "event_busy", accent: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" },
  { key: "partial-inventory", labelKey: "nodaStatusPartialInventory", icon: "error", accent: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  { key: "cancelled", labelKey: "nodaStatusCancelled", icon: "cancel", accent: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
];

export const NODA_CART_STORAGE_KEYS = {
  items: "nodaCart",
  pickupDate: "nodaCartPickupDate",
  deadlineDate: "nodaCartDeadlineDate",
  deliveryOrder: "nodaCartDeliveryOrder",
  deliveryNote: "nodaCartDeliveryNote",
};

export function joinNodaClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function canManageNodaRequests(authUser = {}) {
  return NODA_EDIT_ROLES.includes(authUser?.role || "");
}

export function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

export function tomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

export function normalizeNodaStatistics(stats = {}) {
  return {
    ...EMPTY_NODA_STATS,
    ...stats,
  };
}

export function safeParseNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function isBulkNodaRequest(request = {}) {
  return request?.requestType === "bulk";
}

export function getNodaPickupDateValue(request = {}) {
  return isBulkNodaRequest(request) ? request?.pickupDate : request?.date;
}

export function formatNodaDate(value) {
  if (!value) return "—";
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function formatNodaDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function formatNodaTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildNodaQueryFilters({
  activeStatus = "all",
  status = "",
  partNumber = "",
  backNumber = "",
  dateFrom = "",
  dateTo = "",
  search = "",
} = {}) {
  const filters = {};

  const normalizedStatus = activeStatus && activeStatus !== "all"
    ? activeStatus
    : status;

  if (normalizedStatus === "past-deadline") {
    filters.pastDeadline = true;
  } else if (normalizedStatus) {
    filters.status = normalizedStatus;
  }

  if (partNumber) {
    filters["品番"] = partNumber;
  }

  if (backNumber) {
    filters["背番号"] = backNumber;
  }

  if (dateFrom || dateTo) {
    filters.dateRange = {};
    if (dateFrom) filters.dateRange.from = dateFrom;
    if (dateTo) filters.dateRange.to = dateTo;
  }

  const trimmedSearch = String(search || "").trim();
  if (trimmedSearch) {
    filters.search = trimmedSearch;
  }

  return filters;
}

export function getNodaStatusMeta(status) {
  switch (status) {
    case "pending":
      return {
        labelKey: "pending",
        icon: "schedule",
        badgeClassName: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
      };
    case "waiting-for-inventory":
      return {
        labelKey: "nodaStatusWaitingForInventory",
        icon: "error",
        badgeClassName: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
      };
    case "partial-inventory":
      return {
        labelKey: "nodaStatusPartialInventory",
        icon: "error",
        badgeClassName: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
      };
    case "past-deadline":
      return {
        labelKey: "nodaStatusDeadlinePassed",
        icon: "event_busy",
        badgeClassName: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
      };
    case "in-progress":
    case "active":
      return {
        labelKey: "nodaStatusInProgress",
        icon: "play_circle",
        badgeClassName: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
      };
    case "completed":
    case "complete":
      return {
        labelKey: "nodaStatusCompleted",
        icon: "task_alt",
        badgeClassName: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
      };
    case "failed":
      return {
        labelKey: "nodaStatusFailed",
        icon: "cancel",
        badgeClassName: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
      };
    case "cancelled":
      return {
        labelKey: "nodaStatusCancelled",
        icon: "block",
        badgeClassName: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
      };
    default:
      return {
        labelKey: "unknownLabel",
        icon: "help",
        badgeClassName: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
      };
  }
}

export function resolveNodaDisplayStatus(request = {}) {
  const isCompletedRequest = request?.status === "completed" || request?.status === "cancelled";
  const isPastDeadline = Boolean(request?.isPastDeadline || request?.dynamicInventoryStatus === "past-deadline");
  const dynamicStatus = isCompletedRequest
    ? "completed"
    : (request?.dynamicInventoryStatus || request?.overallInventoryStatus || request?.status);

  if (isPastDeadline) return "past-deadline";
  if (isCompletedRequest) return request?.status || "completed";

  if (dynamicStatus === "sufficient") {
    return "pending";
  }

  if (dynamicStatus === "waiting-for-inventory" || dynamicStatus === "partial-inventory") {
    return dynamicStatus;
  }

  return request?.status || dynamicStatus || "unknown";
}

export function getNodaRowToneClass(request = {}) {
  const displayStatus = resolveNodaDisplayStatus(request);
  const dynamicStatus = request?.dynamicInventoryStatus || request?.overallInventoryStatus;
  const isCompletedRequest = request?.status === "completed" || request?.status === "cancelled";

  if (displayStatus === "past-deadline") {
    return "bg-slate-100/70 dark:bg-slate-900/40 border-l-4 border-slate-400 opacity-85";
  }

  if (isCompletedRequest) {
    return "";
  }

  if (dynamicStatus === "waiting-for-inventory") {
    return "bg-rose-50/90 dark:bg-rose-950/20 border-l-4 border-rose-500";
  }

  if (dynamicStatus === "partial-inventory") {
    return "bg-amber-50/90 dark:bg-amber-950/20 border-l-4 border-amber-500";
  }

  return "";
}

export function getNodaItemsSummary(request = {}, t) {
  if (!isBulkNodaRequest(request)) {
    return {
      title: request?.品番 || "—",
      subtitle: t("singleItemSubtitle", { serial: request?.背番号 || "—", qty: safeParseNumber(request?.quantity) }),
      warnings: [],
    };
  }

  const lineItems = Array.isArray(request?.lineItems) ? request.lineItems : [];
  const totalItems = lineItems.length;
  const completedItems = lineItems.filter((lineItem) => lineItem?.status === "completed").length;
  const pendingItems = lineItems.filter((lineItem) => lineItem?.status === "pending").length;

  let waitingCount = 0;
  let partialCount = 0;
  const fifoStatuses = Array.isArray(request?.fifoAllocation?.lineItemStatuses)
    ? request.fifoAllocation.lineItemStatuses
    : [];

  if (fifoStatuses.length) {
    waitingCount = fifoStatuses.filter((lineItem) => lineItem?.fifoStatus === "waiting").length;
    partialCount = fifoStatuses.filter((lineItem) => lineItem?.fifoStatus === "partial").length;
  } else {
    waitingCount = lineItems.filter((lineItem) => lineItem?.inventoryStatus === "none").length;
    partialCount = lineItems.filter((lineItem) => lineItem?.inventoryStatus === "insufficient").length;
  }

  const warnings = [];
  if (request?.isPastDeadline || request?.dynamicInventoryStatus === "past-deadline") {
    warnings.push({ tone: "muted", label: t("deadlinePassedWarning") });
  } else {
    if (waitingCount > 0) warnings.push({ tone: "danger", label: t("waitingCountWarning", { count: waitingCount }) });
    if (partialCount > 0) warnings.push({ tone: "warning", label: t("partialCountWarning", { count: partialCount }) });
  }

  return {
    title: t("itemsCountTitle", { count: totalItems }),
    subtitle: t("doneAndPendingSubtitle", { done: completedItems, pending: pendingItems }),
    warnings,
  };
}

export function buildNodaPageInfo({ filteredCount, page, pageSize, t }) {
  if (!filteredCount) return t("noRequestsToDisplay");
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, filteredCount);
  return t("requestsShowingRange", { count: filteredCount, start, end });
}

export function normalizeQuotedCsvValue(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

export function normalizeCsvDate(value) {
  const normalized = normalizeQuotedCsvValue(value);
  if (!normalized) return "";
  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
  }
  return normalized;
}

export function serializeCsvRow(cells = []) {
  return cells.map((cell) => {
    const normalized = String(cell ?? "").replace(/"/g, '""');
    return `"${normalized}"`;
  }).join(",");
}

export function downloadCsvFile(filename, rows) {
  const csv = rows.map((row) => serializeCsvRow(row)).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function loadNodaCartDraftFromStorage() {
  try {
    const cart = JSON.parse(localStorage.getItem(NODA_CART_STORAGE_KEYS.items) || "[]");
    return {
      cart: Array.isArray(cart) ? cart : [],
      pickupDate: localStorage.getItem(NODA_CART_STORAGE_KEYS.pickupDate) || "",
      deadlineDate: localStorage.getItem(NODA_CART_STORAGE_KEYS.deadlineDate) || "",
      deliveryOrder: localStorage.getItem(NODA_CART_STORAGE_KEYS.deliveryOrder) || "",
      deliveryNote: localStorage.getItem(NODA_CART_STORAGE_KEYS.deliveryNote) || "",
    };
  } catch {
    return {
      cart: [],
      pickupDate: "",
      deadlineDate: "",
      deliveryOrder: "",
      deliveryNote: "",
    };
  }
}

export function saveNodaCartDraftToStorage({ cart, pickupDate, deadlineDate, deliveryOrder, deliveryNote }) {
  localStorage.setItem(NODA_CART_STORAGE_KEYS.items, JSON.stringify(Array.isArray(cart) ? cart : []));

  const values = {
    [NODA_CART_STORAGE_KEYS.pickupDate]: pickupDate,
    [NODA_CART_STORAGE_KEYS.deadlineDate]: deadlineDate,
    [NODA_CART_STORAGE_KEYS.deliveryOrder]: deliveryOrder,
    [NODA_CART_STORAGE_KEYS.deliveryNote]: deliveryNote,
  };

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  });
}

export function clearNodaCartDraftStorage() {
  Object.values(NODA_CART_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

export function calculateAllocatedQuantities(requests = []) {
  return requests.reduce((accumulator, request) => {
    const lineItems = Array.isArray(request?.lineItems) ? request.lineItems : [];
    lineItems.forEach((lineItem) => {
      const serialNumber = String(lineItem?.背番号 || "").trim();
      if (!serialNumber) return;
      accumulator[serialNumber] = safeParseNumber(accumulator[serialNumber]) + safeParseNumber(lineItem?.quantity);
    });
    return accumulator;
  }, {});
}

export function groupDuplicateGenItems(items = []) {
  const grouped = items.reduce((accumulator, item) => {
    const serialNumber = String(item?.背番号 || "").trim();
    if (!serialNumber) return accumulator;

    if (!accumulator[serialNumber]) {
      accumulator[serialNumber] = {
        背番号: item.背番号,
        品番: item.品番,
        entries: [],
      };
    }

    accumulator[serialNumber].entries.push(item);
    return accumulator;
  }, {});

  return Object.fromEntries(
    Object.entries(grouped).filter(([, group]) => group.entries.length > 1),
  );
}

export function consolidateGenItems(items = []) {
  const consolidatedMap = new Map();

  items.forEach((item) => {
    const serialNumber = String(item?.背番号 || "").trim();
    if (!serialNumber) return;

    if (consolidatedMap.has(serialNumber)) {
      consolidatedMap.set(serialNumber, {
        ...consolidatedMap.get(serialNumber),
        quantity: safeParseNumber(consolidatedMap.get(serialNumber)?.quantity) + safeParseNumber(item?.quantity),
      });
      return;
    }

    consolidatedMap.set(serialNumber, {
      ...item,
      quantity: safeParseNumber(item?.quantity),
    });
  });

  return Array.from(consolidatedMap.values());
}

export function calculateRemainingGenItems(items = [], allocatedQuantities = {}) {
  return items.map((item) => {
    const allocated = safeParseNumber(allocatedQuantities[item?.背番号]);
    const genTotal = safeParseNumber(item?.quantity);
    const remainingQty = Math.max(0, genTotal - allocated);

    return {
      ...item,
      genTotal,
      allocatedQty: allocated,
      remainingQty,
    };
  });
}

export function getNextNodaRequestNumber(existingRequests = [], deliveryDate) {
  const dateToken = String(deliveryDate || "").replace(/-/g, "");
  if (!existingRequests.length) {
    return `NODAPO-${dateToken}-001`;
  }

  const nextSequence = existingRequests.reduce((maxSequence, request) => {
    const match = String(request?.requestNumber || "").match(/-(\d{3})$/);
    if (!match) return maxSequence;
    return Math.max(maxSequence, safeParseNumber(match[1]));
  }, 0) + 1;

  return `NODAPO-${dateToken}-${String(nextSequence).padStart(3, "0")}`;
}