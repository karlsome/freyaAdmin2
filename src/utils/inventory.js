export const INVENTORY_ADD_ROLES = ["admin", "課長", "係長"];
export const INVENTORY_ADMIN_ROLES = ["admin"];
export const INVENTORY_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const EMPTY_INVENTORY_SUMMARY = {
  totalItems: 0,
  totalPhysicalStock: 0,
  totalReservedStock: 0,
  totalAvailableStock: 0,
};

export const INVENTORY_SUMMARY_CARDS = [
  { key: "totalItems", label: "Items", icon: "inventory_2", accent: "bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200" },
  { key: "totalPhysicalStock", label: "Physical Stock", icon: "warehouse", accent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { key: "totalReservedStock", label: "Reserved Stock", icon: "bookmarks", accent: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { key: "totalAvailableStock", label: "Available Stock", icon: "check_circle", accent: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
];

export const INVENTORY_BATCH_FILTER_FIELDS = [
  { field: "品番", label: "Part Number", group: "Inventory", type: "text", operators: ["equals", "contains"] },
  { field: "背番号", label: "Serial Number", group: "Inventory", type: "text", operators: ["equals", "contains"] },
  { field: "工場", label: "Factory", group: "Inventory", type: "text", operators: ["equals", "contains"] },
  { field: "モデル", label: "Model", group: "Inventory", type: "text", operators: ["equals", "contains"] },
];

export const INVENTORY_ADVANCED_FILTER_FIELDS = [
  { field: "品番", label: "Part Number", group: "Identity", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "背番号", label: "Serial Number", group: "Identity", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "工場", label: "Factory", group: "Identity", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "physicalQuantity", label: "Physical Stock", group: "Stock", type: "number", operators: ["equals", "not_equals", "greater", "less", "range", "exists", "not_exists"] },
  { field: "reservedQuantity", label: "Reserved Stock", group: "Stock", type: "number", operators: ["equals", "not_equals", "greater", "less", "range", "exists", "not_exists"] },
  { field: "availableQuantity", label: "Available Stock", group: "Stock", type: "number", operators: ["equals", "not_equals", "greater", "less", "range", "exists", "not_exists"] },
  { field: "lastUpdated", label: "Last Updated", group: "Dates", type: "date", operators: ["equals", "not_equals", "greater", "less", "range", "exists", "not_exists"] },
];

export const INVENTORY_OPERATOR_LABELS = {
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

let inventoryBatchFilterCount = 0;
let inventoryAdvancedFilterCount = 0;

export function joinInventoryClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function canAddInventory(authUser = {}) {
  return INVENTORY_ADD_ROLES.includes(authUser?.role || "");
}

export function canAdminResetInventory(authUser = {}) {
  return INVENTORY_ADMIN_ROLES.includes(authUser?.role || "");
}

export function createInventoryBatchResetRow() {
  inventoryBatchFilterCount += 1;
  return {
    id: `inventory-batch-filter-${Date.now()}-${inventoryBatchFilterCount}`,
    field: "",
    operator: "",
    value: "",
    valueFrom: "",
    valueTo: "",
  };
}

export function createInventoryAdvancedFilterRow() {
  inventoryAdvancedFilterCount += 1;
  return {
    id: `inventory-advanced-filter-${Date.now()}-${inventoryAdvancedFilterCount}`,
    field: "",
    operator: "",
    value: "",
    valueFrom: "",
    valueTo: "",
  };
}

export function buildInventoryQueryFilters({
  partNumber = "",
  backNumber = "",
  search = "",
  selectedBackNumbers = [],
  advancedFilters = [],
} = {}) {
  const filters = {};

  if (partNumber) {
    filters["品番"] = partNumber;
  }

  if (Array.isArray(selectedBackNumbers) && selectedBackNumbers.length > 0) {
    filters.sebanggoArray = selectedBackNumbers;
  } else if (backNumber) {
    filters["背番号"] = backNumber;
  }

  const trimmedSearch = String(search || "").trim();
  if (trimmedSearch) {
    filters.search = trimmedSearch;
  }

  if (Array.isArray(advancedFilters) && advancedFilters.length > 0) {
    filters.advancedFilters = advancedFilters;
  }

  return filters;
}

export function buildInventoryAdvancedFilterClauses(rows = [], fieldDefinitions = []) {
  const fieldMap = new Map(fieldDefinitions.map((field) => [field.field, field]));

  return rows.flatMap((row) => {
    const field = String(row?.field || "").trim();
    const operator = String(row?.operator || "").trim();
    const fieldDefinition = fieldMap.get(field);

    if (!field || !operator || !fieldDefinition) return [];

    if (operator === "exists" || operator === "not_exists") {
      return [{
        field,
        operator,
        type: fieldDefinition.type,
        value: "",
      }];
    }

    if (operator === "range") {
      const valueFrom = String(row?.valueFrom || "").trim();
      const valueTo = String(row?.valueTo || "").trim();
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
      const rawValues = Array.isArray(row?.value)
        ? row.value
        : String(row?.value || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

      if (!rawValues.length) return [];
      return [{
        field,
        operator,
        type: fieldDefinition.type,
        value: rawValues,
      }];
    }

    const rawValue = row?.value;
    const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
    if (value === "" || value == null) return [];

    return [{
      field,
      operator,
      type: fieldDefinition.type,
      value,
    }];
  });
}

export function buildInventoryBatchResetFilters(rows = []) {
  return rows.flatMap((row) => {
    const field = String(row?.field || "").trim();
    const operator = String(row?.operator || "").trim();
    const value = String(row?.value || "").trim();

    if (!field || !operator || !value) return [];
    return [{ field, operator, value }];
  });
}

export function formatInventoryNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0";
  return numericValue.toLocaleString();
}

export function formatInventoryDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function formatInventoryDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export function buildInventoryPageInfo({ filteredCount, page, pageSize }) {
  const safeCount = Number(filteredCount) || 0;
  if (!safeCount) return "0 items shown";

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, safeCount);
  return `${safeCount.toLocaleString()} items, showing ${start.toLocaleString()}-${end.toLocaleString()}`;
}

export function getInventoryAvailabilityMeta(value) {
  const availableQuantity = Number(value) || 0;

  if (availableQuantity <= 0) {
    return {
      label: "Out of Stock",
      icon: "cancel",
      badgeClassName: "bg-error/10 text-error",
      rowClassName: "bg-error/5",
    };
  }

  if (availableQuantity <= 10) {
    return {
      label: "Low Stock",
      icon: "warning",
      badgeClassName: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      rowClassName: "bg-amber-500/5",
    };
  }

  return {
    label: "Available",
    icon: "check_circle",
    badgeClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    rowClassName: "",
  };
}

export function getInventoryRowToneClass(item = {}) {
  return getInventoryAvailabilityMeta(item?.availableQuantity).rowClassName;
}

export function getInventoryTransactionActionMeta(action = "") {
  const normalized = String(action || "").toLowerCase();

  if (normalized.includes("reset") || action.includes("リセット")) {
    return { icon: "restart_alt", badgeClassName: "bg-error/10 text-error" };
  }
  if (normalized.includes("reservation") || normalized.includes("reserve") || normalized.includes("引当")) {
    return { icon: "bookmarks", badgeClassName: "bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  }
  if (normalized.includes("manual inventory add") || normalized.includes("stock") || normalized.includes("delivery")) {
    return { icon: "inventory_2", badgeClassName: "bg-sky-500/10 text-sky-700 dark:text-sky-300" };
  }
  if (normalized.includes("completed") || normalized.includes("picked")) {
    return { icon: "task_alt", badgeClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  }
  if (normalized.includes("failed") || normalized.includes("cancelled")) {
    return { icon: "cancel", badgeClassName: "bg-error/10 text-error" };
  }

  return { icon: "info", badgeClassName: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200" };
}

export function buildInventoryExportMatrix(rows = []) {
  return [
    ["Part Number", "Serial Number", "Factory", "Physical Stock", "Reserved Stock", "Available Stock", "Last Updated"],
    ...rows.map((row) => ([
      row.品番 || "",
      row.背番号 || "",
      row.工場 || "",
      Number(row.physicalQuantity) || 0,
      Number(row.reservedQuantity) || 0,
      Number(row.availableQuantity) || 0,
      formatInventoryDateTime(row.lastUpdated),
    ])),
  ];
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function downloadInventoryCsvFile(fileName, rows = []) {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function summarizeSelectedInventoryTags(selectedBackNumbers = []) {
  if (!Array.isArray(selectedBackNumbers) || selectedBackNumbers.length === 0) {
    return { countLabel: "None selected", visible: [], overflow: 0 };
  }

  return {
    countLabel: `${selectedBackNumbers.length} products selected`,
    visible: selectedBackNumbers.slice(0, 10),
    overflow: Math.max(selectedBackNumbers.length - 10, 0),
  };
}