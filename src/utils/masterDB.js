export const MASTER_TABS = [
  { key: "masterDB", label: "内装品 DB", description: "Interior product records", ready: true },
  { key: "materialDB", label: "材料 DB", description: "Planned next", ready: false },
  { key: "productPDFs", label: "梱包 / 検査基準 / 3点照合", description: "Planned next", ready: false },
  { key: "furyoKanri", label: "不良管理", description: "Planned next", ready: false },
];

export const MASTER_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const MASTER_DEFAULT_FIELDS = [
  "品番",
  "モデル",
  "背番号",
  "品名",
  "形状",
  "R/L",
  "色",
  "顧客/納入先",
  "備考",
  "加工設備",
  "QR CODE",
  "型番",
  "材料品番",
  "材料背番号",
  "材料",
  "収容数",
  "工場",
  "秒数(1pcs何秒)",
  "離型紙上/下",
  "送りピッチ",
  "SRS",
  "SLIT",
  "boardData",
];

const PRIORITY_FIELDS = [
  "品番",
  "モデル",
  "背番号",
  "品名",
  "形状",
  "R/L",
  "色",
  "顧客/納入先",
  "備考",
  "加工設備",
  "QR CODE",
  "型番",
  "材料品番",
  "材料背番号",
  "材料",
  "収容数",
  "工場",
  "秒数(1pcs何秒)",
  "離型紙上/下",
  "送りピッチ",
  "SRS",
  "SLIT",
  "boardData",
];

const NUMERIC_FIELD_PATTERN = /(total|count|quantity|seconds|秒数|収容数|梱包数|温度|ピッチ|srs|slit)/i;
const DATE_FIELD_PATTERN = /(^date$|日付|年月日)/i;
const TIME_FIELD_PATTERN = /(time|時刻|時間)/i;
const TEXTAREA_FIELD_PATTERN = /(備考|note|boardData|説明|comment)/i;

const OPERATOR_LABELS = {
  equals: "Equals",
  contains: "Contains",
  in: "In",
  greater: "Greater than",
  less: "Less than",
  range: "Range",
};

let filterRowCount = 0;

export function createMasterFilterRow() {
  filterRowCount += 1;
  return {
    id: `master-filter-${Date.now()}-${filterRowCount}`,
    field: "",
    operator: "",
    value: "",
    valueFrom: "",
    valueTo: "",
  };
}

export function getMasterTabMeta(tabKey) {
  return MASTER_TABS.find((tab) => tab.key === tabKey) || MASTER_TABS[0];
}

export function cleanMasterRecords(records = []) {
  return records.filter((record) => {
    if (!record || typeof record !== "object") return false;
    const values = Object.values(record);
    const hasHeaderCorruption =
      record[""] === "品番" ||
      record._1 === "モデル" ||
      record["製品背番号一覧"] === "背番号" ||
      record._2 === "材料" ||
      values.includes("品番") ||
      values.includes("モデル") ||
      values.includes("背番号");
    return !hasHeaderCorruption;
  });
}

export function extractRecordId(record) {
  return record?._id?.$oid || record?._id || null;
}

export function decodeMasterCsvBuffer(buffer) {
  const attempts = [
    ["shift-jis", true],
    ["utf-8", false],
  ];

  for (const [encoding, fatal] of attempts) {
    try {
      return new TextDecoder(encoding, { fatal }).decode(buffer);
    } catch {
      continue;
    }
  }

  return new TextDecoder().decode(buffer);
}

function inferFieldGroup(field) {
  if (/(品番|背番号|モデル|型番|QR)/i.test(field)) return "Identity";
  if (/(品名|形状|色|R\/L|顧客|納入|備考)/i.test(field)) return "Product";
  if (/(加工設備|工場|工程|温度|離型紙|送りピッチ|SRS|SLIT)/i.test(field)) return "Process";
  if (/(材料|梱包|収容|boardData)/i.test(field)) return "Material & Packaging";
  return "Other";
}

export function inferMasterFieldType(field) {
  if (field === "imageURL") return "image";
  if (TEXTAREA_FIELD_PATTERN.test(field)) return "textarea";
  if (DATE_FIELD_PATTERN.test(field)) return "date";
  if (TIME_FIELD_PATTERN.test(field)) return "time";
  if (NUMERIC_FIELD_PATTERN.test(field)) return "number";
  return "text";
}

export function getMasterFieldOrder(schemaFields = [], records = []) {
  const fieldSet = new Set();

  schemaFields.forEach((field) => {
    if (field && field !== "_id" && field !== "imageURL") fieldSet.add(field);
  });

  records.forEach((record) => {
    if (!record || typeof record !== "object") return;
    Object.keys(record).forEach((field) => {
      if (field && field !== "_id" && field !== "imageURL") fieldSet.add(field);
    });
  });

  if (!fieldSet.size) {
    MASTER_DEFAULT_FIELDS.forEach((field) => fieldSet.add(field));
  }

  const fields = [...fieldSet].filter(Boolean);
  const ordered = PRIORITY_FIELDS.filter((field) => fields.includes(field));
  const remainder = fields
    .filter((field) => !ordered.includes(field))
    .sort((left, right) => String(left).localeCompare(String(right), "ja"));

  return [...ordered, ...remainder];
}

export function buildMasterFieldDefinitions(schemaFields = [], records = []) {
  return getMasterFieldOrder(schemaFields, records).map((field) => {
    const type = inferMasterFieldType(field);
    const operators = type === "date"
      ? ["equals", "range"]
      : type === "number"
        ? ["equals", "greater", "less", "range"]
        : type === "time"
          ? ["equals", "greater", "less"]
          : ["equals", "contains", "in"];

    return {
      field,
      label: field,
      type,
      group: inferFieldGroup(field),
      operators,
    };
  });
}

export function buildSearchFields(fieldDefinitions = []) {
  return fieldDefinitions
    .filter((field) => ["text", "textarea", "time"].includes(field.type))
    .map((field) => field.field);
}

export function getMasterTableColumns(records = [], schemaFields = []) {
  return [
    ...getMasterFieldOrder(schemaFields, records).map((field) => ({ key: field, label: field })),
    { key: "imageURL", label: "画像" },
  ];
}

function coerceFilterValue(value, fieldDefinition) {
  if (fieldDefinition?.type === "number") {
    const next = Number(value);
    return Number.isFinite(next) ? next : value;
  }
  return value;
}

export function buildMasterAdvancedQuery(rows = [], fieldDefinitions = []) {
  const fieldMap = Object.fromEntries(fieldDefinitions.map((field) => [field.field, field]));
  const query = {};

  rows.forEach((row) => {
    const fieldDefinition = fieldMap[row.field];
    if (!row.field || !row.operator || !fieldDefinition) return;

    if (row.operator === "range") {
      if (row.valueFrom === "" || row.valueTo === "") return;
      query[row.field] = {
        $gte: coerceFilterValue(row.valueFrom, fieldDefinition),
        $lte: coerceFilterValue(row.valueTo, fieldDefinition),
      };
      return;
    }

    if (row.operator === "in") {
      const values = Array.isArray(row.value)
        ? row.value.filter(Boolean)
        : String(row.value || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
      if (!values.length) return;
      query[row.field] = { $in: values.map((value) => coerceFilterValue(value, fieldDefinition)) };
      return;
    }

    if (row.value === "" || row.value == null) return;

    const value = coerceFilterValue(row.value, fieldDefinition);
    if (row.operator === "equals") query[row.field] = value;
    if (row.operator === "contains") query[row.field] = { $regex: row.value, $options: "i" };
    if (row.operator === "greater") query[row.field] = { $gt: value };
    if (row.operator === "less") query[row.field] = { $lt: value };
  });

  return query;
}

export function getActiveMasterAdvancedFilters(rows = [], fieldDefinitions = []) {
  const fieldMap = Object.fromEntries(fieldDefinitions.map((field) => [field.field, field]));

  return rows.flatMap((row) => {
    if (!row.field || !row.operator) return [];
    const fieldDefinition = fieldMap[row.field];
    if (!fieldDefinition) return [];

    let renderedValue = "";
    if (row.operator === "range") {
      if (row.valueFrom === "" || row.valueTo === "") return [];
      renderedValue = `${row.valueFrom} - ${row.valueTo}`;
    } else if (row.operator === "in") {
      const values = Array.isArray(row.value) ? row.value : [];
      if (!values.length) return [];
      renderedValue = values.join(", ");
    } else {
      if (row.value === "" || row.value == null) return [];
      renderedValue = String(row.value);
    }

    return [{
      id: row.id,
      field: row.field,
      label: fieldDefinition.label,
      operator: OPERATOR_LABELS[row.operator] || row.operator,
      value: renderedValue,
    }];
  });
}

export function formatMasterValue(value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
  if (currentPage >= totalPages - 3) return [1, "ellipsis-left", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages];
}

export function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem("authUser") || "{}");
  } catch {
    return {};
  }
}