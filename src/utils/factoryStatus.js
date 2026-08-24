export const FACTORY_STATUS_PAGE_SIZE = 10;
export const FACTORY_STATUS_AUTO_REFRESH_MS = 60_000;
export const FACTORY_STATUS_PREFERRED_FACTORIES = ["小瀬", "第二工場", "肥田瀬"];
export const FACTORY_STATUS_LOG_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const FACTORY_STATUS_RESTRICTED_ROLES = new Set(["班長", "係長"]);

export const FACTORY_STATUS_STATUS_OPTIONS = [
  "running",
  "stale",
  "idle",
];

export const FACTORY_STATUS_OPERATOR_LABELS = {
  equals: "equals",
  not_equals: "is not",
  contains: "contains",
  in: "in",
  exists: "exists",
  not_exists: "does not exist",
  greater: "greater than",
  less: "less than",
  range: "range",
};

export const FACTORY_STATUS_ADVANCED_FILTER_FIELDS = [
  { field: "equipment", label: "Equipment", group: "Machine", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "statusKey", label: "Status", group: "Machine", type: "select", operators: ["equals", "not_equals", "in", "exists", "not_exists"], options: FACTORY_STATUS_STATUS_OPTIONS },
  { field: "workerName", label: "Operator", group: "Worker", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "latestAction", label: "Latest Action", group: "Activity", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "partNumber", label: "Part Number", group: "Product", type: "text", operators: ["equals", "not_equals", "contains", "exists", "not_exists"] },
  { field: "backNumber", label: "Serial Number", group: "Product", type: "text", operators: ["equals", "not_equals", "contains", "exists", "not_exists"] },
  { field: "todayActualQuantity", label: "Today Actual", group: "Output", type: "number", operators: ["equals", "not_equals", "greater", "less", "range", "exists", "not_exists"] },
  { field: "lastUpdatedMinutes", label: "Last Update Age (min)", group: "Activity", type: "number", operators: ["equals", "not_equals", "greater", "less", "range", "exists", "not_exists"] },
];

let factoryStatusFilterRowCount = 0;

function asTrimmedString(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function getFactoryStatusOperatorName(row = {}) {
  return asTrimmedString(row?.workerName) || asTrimmedString(row?.inspectorName) || "";
}

function coerceFactoryStatusValue(value, fieldDefinition) {
  if (fieldDefinition?.type === "number") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : value;
  }

  return asTrimmedString(value);
}

export function createFactoryStatusAdvancedFilterRow() {
  factoryStatusFilterRowCount += 1;

  return {
    id: `factory-status-filter-${Date.now()}-${factoryStatusFilterRowCount}`,
    field: "",
    operator: "",
    value: "",
    valueFrom: "",
    valueTo: "",
  };
}

export function buildFactoryStatusAdvancedFilterClauses(rows = [], fieldDefinitions = []) {
  const fieldMap = new Map(fieldDefinitions.map((field) => [field.field, field]));

  return rows.flatMap((row) => {
    const field = asTrimmedString(row?.field);
    const operator = asTrimmedString(row?.operator);
    const fieldDefinition = fieldMap.get(field);

    if (!field || !operator || !fieldDefinition) return [];

    if (operator === "range") {
      const valueFrom = asTrimmedString(row?.valueFrom);
      const valueTo = asTrimmedString(row?.valueTo);
      if (!valueFrom || !valueTo) return [];

      return [{
        field,
        operator,
        type: fieldDefinition.type,
        valueFrom,
        valueTo,
      }];
    }

    if (operator === "in") {
      const values = Array.isArray(row?.value)
        ? row.value.map(asTrimmedString).filter(Boolean)
        : asTrimmedString(row?.value)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

      if (!values.length) return [];

      return [{
        field,
        operator,
        type: fieldDefinition.type,
        value: values,
      }];
    }

    const rawValue = typeof row?.value === "string" ? row.value.trim() : row?.value;
    if (rawValue === "" || rawValue == null) return [];

    return [{
      field,
      operator,
      type: fieldDefinition.type,
      value: coerceFactoryStatusValue(rawValue, fieldDefinition),
    }];
  });
}

export function formatFactoryStatusNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0";
  return numericValue.toLocaleString();
}

export function formatFactoryStatusDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ja-JP");
}

export function formatFactoryStatusDuration(value) {
  const totalMinutes = Number(value);
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "—";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function buildFactoryStatusPageInfo({ filteredCount, page, pageSize }) {
  const safeCount = Number(filteredCount) || 0;
  if (!safeCount) return "0 machines shown";

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, safeCount);
  return `${safeCount.toLocaleString()} machines, showing ${start.toLocaleString()}-${end.toLocaleString()}`;
}

export function buildFactoryStatusLogPageInfo({ filteredCount, page, pageSize }) {
  const safeCount = Number(filteredCount) || 0;
  if (!safeCount) return "0 logs shown";

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, safeCount);
  return `${safeCount.toLocaleString()} logs, showing ${start.toLocaleString()}-${end.toLocaleString()}`;
}

export function getFactoryStatusBadgeMeta(statusKey) {
  switch (statusKey) {
    case "running":
      return {
        label: "Running",
        icon: "play_circle",
        badgeClassName: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
      };
    case "stale":
      return {
        label: "Stale",
        icon: "schedule",
        badgeClassName: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
      };
    default:
      return {
        label: "Idle",
        icon: "pause_circle",
        badgeClassName: "bg-surface-container text-on-surface-variant",
      };
  }
}

export function getFactoryStatusLogStatusMeta(status) {
  const normalized = asTrimmedString(status).toLowerCase();

  if (normalized.includes("complete") || normalized.includes("done")) {
    return {
      label: asTrimmedString(status) || "Completed",
      badgeClassName: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    };
  }

  if (normalized.includes("error") || normalized.includes("failed")) {
    return {
      label: asTrimmedString(status) || "Error",
      badgeClassName: "bg-error/12 text-error",
    };
  }

  if (normalized.includes("pause") || normalized.includes("break") || normalized.includes("hold")) {
    return {
      label: asTrimmedString(status) || "Paused",
      badgeClassName: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    };
  }

  return {
    label: asTrimmedString(status) || "In Progress",
    badgeClassName: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  };
}

export function getFactoryStatusRowToneClass(row = {}) {
  if (row.statusKey === "running") return "bg-emerald-500/4 hover:bg-emerald-500/8";
  if (row.statusKey === "stale") return "bg-amber-500/4 hover:bg-amber-500/8";
  return "";
}

export function sortFactoryStatusFactories(factories = []) {
  const rankMap = new Map(FACTORY_STATUS_PREFERRED_FACTORIES.map((factory, index) => [factory, index]));
  const uniqueFactories = [...new Set((Array.isArray(factories) ? factories : [factories]).map(asTrimmedString).filter(Boolean))];

  return uniqueFactories.sort((left, right) => {
    const leftRank = rankMap.has(left) ? rankMap.get(left) : Number.MAX_SAFE_INTEGER;
    const rightRank = rankMap.has(right) ? rankMap.get(right) : Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.localeCompare(right, "ja");
  });
}

export function getDefaultFactoryStatusSelection(availableFactories = []) {
  const orderedFactories = sortFactoryStatusFactories(availableFactories);
  const preferredSelection = FACTORY_STATUS_PREFERRED_FACTORIES.filter((factory) => orderedFactories.includes(factory));

  if (preferredSelection.length) return preferredSelection;
  return orderedFactories.slice(0, Math.min(3, orderedFactories.length));
}

export function getFactoryStatusAccessibleFactories(authUser = {}, availableFactories = []) {
  if (!FACTORY_STATUS_RESTRICTED_ROLES.has(authUser?.role || "")) {
    return sortFactoryStatusFactories(availableFactories);
  }

  const assignedFactories = authUser?.工場 || authUser?.factory || [];
  const normalizedAssigned = (Array.isArray(assignedFactories) ? assignedFactories : [assignedFactories])
    .map(asTrimmedString)
    .filter(Boolean);

  if (!normalizedAssigned.length) return [];
  if (!Array.isArray(availableFactories) || !availableFactories.length) return sortFactoryStatusFactories(normalizedAssigned);

  const allowedSet = new Set(normalizedAssigned);
  return sortFactoryStatusFactories(availableFactories.filter((factory) => allowedSet.has(factory)));
}

export function summarizeFactoryStatusSelection(selectedFactories = []) {
  const cleanFactories = (Array.isArray(selectedFactories) ? selectedFactories : []).map(asTrimmedString).filter(Boolean);
  if (!cleanFactories.length) {
    return {
      countLabel: "No factories selected",
      selectedText: "Choose one or more factories",
    };
  }

  if (cleanFactories.length === 1) {
    return {
      countLabel: "1 factory selected",
      selectedText: cleanFactories[0],
    };
  }

  return {
    countLabel: `${cleanFactories.length} factories selected`,
    selectedText: cleanFactories.join(" · "),
  };
}