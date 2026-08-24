export const MASTER_TABS = [
  { key: "masterDB", label: "内装品 DB", description: "Interior product records", ready: true },
  { key: "materialDB", label: "材料 DB", description: "Material master records", ready: true },
  { key: "productPDFs", label: "梱包 / 検査基準 / 3点照合", description: "Product PDF library", ready: true },
  { key: "materialPDFs", label: "作業条件表 (PSA)", description: "Material PDF library", ready: true },
  { key: "furyoKanri", label: "不良管理", description: "Defect definition management", ready: true },
  { key: "factoryDB", label: "工場", description: "Factory master list", ready: true },
  { key: "setsubiDB", label: "設備", description: "Equipment by factory", ready: true },
  { key: "processDB", label: "工程 DB (Process)", description: "Process master records", ready: true },
  { key: "bomDB", label: "BOM DB", description: "Bill of materials builder", ready: true },
  { key: "pceFiles", label: "pce ファイル", description: "PCE file upload utility", ready: true },
];

export const MASTER_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const MATERIAL_LABEL_OVERRIDES = {
  NMOJI_色コード: "色",
  NMOJI_ユーザー: "次工程",
};

const MATERIAL_PRIORITY_COLUMNS = [
  { key: "品番", label: "品番" },
  { key: "品名", label: "品名" },
  { key: "ラベル品番", label: "ラベル品番" },
  { key: "仕様", label: "仕様" },
  { key: "型番", label: "型番" },
  { key: "梱包数", label: "梱包数" },
  { key: "ロール温度", label: "ロール温度" },
  { key: "ライン形態", label: "ライン形態" },
  { key: "出荷先名", label: "出荷先名" },
  { key: "工程コード", label: "工程コード" },
  { key: "imageURL", label: "画像" },
];

const MATERIAL_DEFAULT_FIELDS = MATERIAL_PRIORITY_COLUMNS
  .filter((column) => column.key !== "imageURL")
  .map((column) => column.key);

const MASTER_TAB_UI = {
  masterDB: {
    processFilterLabel: "Equipment",
    processAllLabel: "All Equipment",
    recordLabel: "Master Record",
    previewFields: ["品番", "品名", "モデル", "背番号", "加工設備", "工場"],
    identityTitleFields: ["品番", "品名", "材料品番"],
    identitySubtitleFields: ["モデル", "背番号"],
  },
  materialDB: {
    processFilterLabel: "Material",
    processAllLabel: "All Material",
    recordLabel: "Material Record",
    previewFields: ["品番", "品名", "ラベル品番", "仕様", "型番", "梱包数"],
    identityTitleFields: ["品番", "品名", "ラベル品番"],
    identitySubtitleFields: ["型番", "仕様", "工程コード"],
  },
};

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
  "刃物",
  "SRS",
  "SLIT",
  "boardData",
];

const PRIORITY_FIELDS_BY_TAB = {
  masterDB: MASTER_DEFAULT_FIELDS,
  materialDB: MATERIAL_DEFAULT_FIELDS,
};

export function getMasterTabUI(tabKey = "masterDB") {
  return MASTER_TAB_UI[tabKey] || MASTER_TAB_UI.masterDB;
}

export function getMasterFieldLabel(field, tabKey = "masterDB") {
  return MATERIAL_LABEL_OVERRIDES[field] || field;
}

function getFirstFilledField(record, fields = []) {
  for (const field of fields) {
    const value = record?.[field];
    if (value != null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return "";
}

export function getMasterRecordIdentity(record = {}, tabKey = "masterDB") {
  const tabUI = getMasterTabUI(tabKey);
  const title = getFirstFilledField(record, tabUI.identityTitleFields);
  const subtitle = tabUI.identitySubtitleFields
    .map((field) => record?.[field])
    .filter((value) => value != null && String(value).trim() !== "")
    .map((value) => String(value))
    .join(" / ");

  return {
    title: title || "Record",
    subtitle,
  };
}

export function getMasterPreviewFields(tabKey = "masterDB") {
  return getMasterTabUI(tabKey).previewFields.map((field) => ({
    field,
    label: getMasterFieldLabel(field, tabKey),
  }));
}

const MASTER_PRIORITY_FIELDS = [
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

function inferFieldGroup(field, tabKey = "masterDB") {
  const label = getMasterFieldLabel(field, tabKey);
  const text = `${field} ${label}`;

  if (/(品番|背番号|モデル|型番|QR|ラベル品番|原材料品番)/i.test(text)) return "Identity";
  if (/(品名|形状|色|R\/L|顧客|納入|備考|仕様)/i.test(text)) return "Product";
  if (/(加工設備|工場|工程|温度|離型紙|送りピッチ|SRS|SLIT|次工程|ユーザー)/i.test(text)) return "Process";
  if (/(材料|梱包|収容|boardData|ロール温度)/i.test(text)) return "Material & Packaging";
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

export function getMasterFieldOrder(schemaFields = [], records = [], tabKey = "masterDB") {
  const fieldSet = new Set();
  const priorityFields = PRIORITY_FIELDS_BY_TAB[tabKey] || MASTER_PRIORITY_FIELDS;

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
    priorityFields.forEach((field) => fieldSet.add(field));
  }

  if (tabKey === "materialDB") {
    priorityFields.forEach((field) => fieldSet.add(field));
  }

  const fields = [...fieldSet].filter(Boolean);
  const ordered = priorityFields.filter((field) => fields.includes(field));
  const remainder = fields
    .filter((field) => !ordered.includes(field))
    .sort((left, right) => String(left).localeCompare(String(right), "ja"));

  return [...ordered, ...remainder];
}

export function buildMasterFieldDefinitions(schemaFields = [], records = [], tabKey = "masterDB") {
  return getMasterFieldOrder(schemaFields, records, tabKey).map((field) => {
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
      label: getMasterFieldLabel(field, tabKey),
      type,
      group: inferFieldGroup(field, tabKey),
      operators,
    };
  });
}

export function buildSearchFields(fieldDefinitions = [], tabKey = "masterDB") {
  const fields = fieldDefinitions
    .filter((field) => ["text", "textarea", "time"].includes(field.type))
    .map((field) => field.field);

  if (tabKey === "materialDB") {
    const extraMaterialFields = [
      "品番",
      "品名",
      "仕様",
      "型番",
      "ラベル品番",
      "品目マスタ.品番",
      "品目マスタ.品名",
      "品目マスタ.仕様",
      "品目マスタ.型番",
      "品目マスタ.ラベル品番",
    ];
    extraMaterialFields.forEach((f) => {
      if (!fields.includes(f)) fields.push(f);
    });
  }

  return fields;
}

export function getMasterTableColumns(records = [], schemaFields = [], tabKey = "masterDB") {
  const orderedFields = getMasterFieldOrder(schemaFields, records, tabKey);

  if (tabKey === "materialDB") {
    const priorityColumns = MATERIAL_PRIORITY_COLUMNS.filter(
      (column) => column.key === "imageURL" || orderedFields.includes(column.key)
    );
    const priorityKeys = new Set(priorityColumns.map((column) => column.key));
    const remainderColumns = orderedFields
      .filter((field) => !priorityKeys.has(field))
      .map((field) => ({ key: field, label: getMasterFieldLabel(field, tabKey) }));

    return [...priorityColumns, ...remainderColumns];
  }

  return [
    ...orderedFields.map((field) => ({ key: field, label: getMasterFieldLabel(field, tabKey) })),
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
  const groupedClauses = new Map();

  rows.forEach((row) => {
    const fieldDefinition = fieldMap[row.field];
    if (!row.field || !row.operator || !fieldDefinition) return;

    let clause = null;

    if (row.operator === "range") {
      if (row.valueFrom === "" || row.valueTo === "") return;
      clause = {
        [row.field]: {
          $gte: coerceFilterValue(row.valueFrom, fieldDefinition),
          $lte: coerceFilterValue(row.valueTo, fieldDefinition),
        },
      };
    }

    if (row.operator === "in" && !clause) {
      const values = Array.isArray(row.value)
        ? row.value.filter(Boolean)
        : String(row.value || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
      if (!values.length) return;
      clause = {
        [row.field]: { $in: values.map((value) => coerceFilterValue(value, fieldDefinition)) },
      };
    }

    if (!clause) {
      if (row.value === "" || row.value == null) return;

      const value = coerceFilterValue(row.value, fieldDefinition);
      if (row.operator === "equals") clause = { [row.field]: value };
      if (row.operator === "contains") clause = { [row.field]: { $regex: row.value, $options: "i" } };
      if (row.operator === "greater") clause = { [row.field]: { $gt: value } };
      if (row.operator === "less") clause = { [row.field]: { $lt: value } };
    }

    if (!clause) return;

    if (!groupedClauses.has(row.field)) {
      groupedClauses.set(row.field, []);
    }

    groupedClauses.get(row.field).push(clause);
  });

  const clauses = Array.from(groupedClauses.values()).map((fieldClauses) => {
    if (fieldClauses.length === 1) return fieldClauses[0];
    return { $or: fieldClauses };
  });

  if (!clauses.length) return {};
  if (clauses.length === 1) return clauses[0];

  return { $and: clauses };
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
  if (Array.isArray(value)) {
    return value.map(v => typeof v === "object" ? formatMasterValue(v) : v).join(", ");
  }
  if (typeof value === "object") {
    // Handle standard code/name resolved objects
    if (value.code !== undefined && value.name !== undefined) {
      return `${value.code} - ${value.name}`;
    }
    
    // Format other objects as key-value pairs
    try {
      return Object.entries(value)
        .map(([k, v]) => {
          let strV = v;
          if (typeof v === "object" && v !== null) {
            if (v.code !== undefined && v.name !== undefined) {
              strV = `${v.code} - ${v.name}`;
            } else {
              strV = JSON.stringify(v); // Fallback for deeper nesting
            }
          }
          return `${k}: ${strV}`;
        })
        .join("\n");
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