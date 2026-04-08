function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeInteger(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
    const parsed = Number.parseInt(normalized.replace(/[^0-9-]/g, ""), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
}

function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseClockMinutes(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -1;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return -1;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1;
  return hours * 60 + minutes;
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function pushSection(sections, key, title, icon, items) {
  if (!items.length) return;
  sections.push({ key, title, icon, items });
}

export const APPROVAL_EDIT_PROTECTED_FIELDS = new Set([
  "_id",
  "_hasDateMismatch",
  "_hasTimeMismatch",
  "_objectIdDate",
  "_objectIdTime",
  "approvalHistory",
  "approvalStatus",
  "approvedAt",
  "approvedBy",
  "correctionAppliedAt",
  "correctionAppliedVia",
  "correctionAt",
  "correctionBy",
  "correctionComment",
  "correctionResponseAt",
  "correctionResponseBy",
  "correctionTarget",
  "createdAt",
  "deleteRequestReason",
  "deleteRequestStatus",
  "deleteRequestedAt",
  "deleteRequestedBy",
  "deleteRequestedByUsername",
  "deletedAt",
  "deletedBy",
  "deletedByUsername",
  "editHistory",
  "hanchoApprovedAt",
  "hanchoApprovedBy",
  "kachoApprovedAt",
  "kachoApprovedBy",
  "originalCollection",
  "originalDoc",
  "restoredAt",
  "restoredBy",
  "restoredByUsername",
]);

export const APPROVAL_EDIT_HIDDEN_FIELDS = APPROVAL_EDIT_PROTECTED_FIELDS;

const APPROVAL_EDIT_AUTO_FIELDS = new Set([
  "Cycle_Time",
  "SRS_Total_NG",
  "Total",
  "Total_Break_Hours",
  "Total_Break_Minutes",
  "Total_NG",
  "Total_Work_Hours",
  "materialLabelImageCount",
]);

const APPROVAL_EDIT_INTEGER_FIELDS = new Set([
  "Process_Quantity",
  "Remaining_Quantity",
  "SRS_Total_NG",
  "Spare",
  "Total",
  "Total_Break_Minutes",
  "Total_NG",
  "Total_Trouble_Minutes",
  "くっつき・めくれ",
  "その他",
  "シワ",
  "ショット数",
  "加工不良",
  "文字欠け",
  "疵引不良",
  "転写不良",
  "転写位置ズレ",
]);

const APPROVAL_EDIT_NUMBER_FIELDS = new Set([
  "Cycle_Time",
  "Total_Break_Hours",
  "Total_Trouble_Hours",
  "Total_Work_Hours",
]);

const APPROVAL_EDIT_TEXTAREA_FIELDS = new Set(["Comment"]);

const SRS_COUNTER_FIELDS = [
  "くっつき・めくれ",
  "シワ",
  "転写位置ズレ",
  "転写不良",
  "文字欠け",
  "その他",
];

const PRESS_COUNTER_FIELDS = ["疵引不良", "加工不良", "その他"];

function addFieldItem(items, processedKeys, draft, key, label, inputKind = undefined) {
  if (!(key in (draft || {}))) return;
  processedKeys.add(key);
  items.push({ kind: "field", path: key, label, inputKind });
}

function addPickerFieldItem(items, processedKeys, draft, key, label, pickerTitle = label) {
  if (!(key in (draft || {}))) return;
  processedKeys.add(key);
  items.push({ kind: "pickerField", path: key, label, pickerTitle });
}

function addStructuredItem(items, processedKeys, draft, key, label) {
  if (!(key in (draft || {}))) return;
  processedKeys.add(key);
  items.push({ kind: "structured", path: key, label, span: "full" });
}

function isImageLikeKey(key) {
  return /(image|画像|photo)/i.test(String(key || ""));
}

export function buildApprovalEditSections(draft = {}, collectionName) {
  const sections = [];
  const processedKeys = new Set();

  const basicItems = [];
  if (draft.品番 !== undefined || draft.背番号 !== undefined) {
    processedKeys.add("品番");
    processedKeys.add("背番号");
    basicItems.push({
      kind: "linkedPair",
      span: "full",
      partNumberPath: "品番",
      partNumberLabel: "品番",
      serialNumberPath: "背番号",
      serialNumberLabel: "背番号",
    });
  }
  addPickerFieldItem(basicItems, processedKeys, draft, "工場", "工場", "工場選択");
  addPickerFieldItem(basicItems, processedKeys, draft, "設備", "設備", "設備選択");
  addPickerFieldItem(basicItems, processedKeys, draft, "Worker_Name", "作業者", "作業者選択");
  addFieldItem(basicItems, processedKeys, draft, "Date", "日付", "date");
  addFieldItem(basicItems, processedKeys, draft, "SRSコード", "SRSコード");
  pushSection(sections, "basic", "基本情報", "info", basicItems);

  const timeItems = [];
  addFieldItem(timeItems, processedKeys, draft, "Time_start", "開始時刻", "time");
  addFieldItem(timeItems, processedKeys, draft, "Time_end", "終了時刻", "time");
  addStructuredItem(timeItems, processedKeys, draft, "Break_Time_Data", "休憩時間");
  addFieldItem(timeItems, processedKeys, draft, "Total_Break_Minutes", "合計休憩（分）", "auto");
  addFieldItem(timeItems, processedKeys, draft, "Total_Break_Hours", "合計休憩（時間）", "auto");
  addFieldItem(timeItems, processedKeys, draft, "Total_Trouble_Minutes", "故障時間（分）", "integer");
  addFieldItem(timeItems, processedKeys, draft, "Total_Trouble_Hours", "故障時間（時間）", "number");
  addFieldItem(timeItems, processedKeys, draft, "Total_Work_Hours", "稼働時間", "auto");
  addFieldItem(timeItems, processedKeys, draft, "Cycle_Time", "サイクルタイム（秒）", "auto");
  addStructuredItem(timeItems, processedKeys, draft, "Maintenance_Data", "メンテナンス / 故障");
  pushSection(sections, "time", "時間・稼働", "schedule", timeItems);

  const quantityItems = [];
  addFieldItem(quantityItems, processedKeys, draft, "Process_Quantity", "処理数量", "integer");
  addFieldItem(quantityItems, processedKeys, draft, "Spare", "予備", "integer");
  addFieldItem(quantityItems, processedKeys, draft, "ショット数", "ショット数", "integer");
  addFieldItem(quantityItems, processedKeys, draft, "Remaining_Quantity", "残数量", "integer");

  if (collectionName === "kensaDB") {
    addStructuredItem(quantityItems, processedKeys, draft, "Counters", "カウンター不良");
    addFieldItem(quantityItems, processedKeys, draft, "Total_NG", "合計不良", "auto");
  }

  if (collectionName === "SRSDB") {
    SRS_COUNTER_FIELDS.forEach((field) => addFieldItem(quantityItems, processedKeys, draft, field, field, "integer"));
    addFieldItem(quantityItems, processedKeys, draft, "SRS_Total_NG", "合計不良", "auto");
  }

  if (collectionName === "pressDB" || collectionName === "slitDB") {
    PRESS_COUNTER_FIELDS.forEach((field) => addFieldItem(quantityItems, processedKeys, draft, field, field, "integer"));
    addFieldItem(quantityItems, processedKeys, draft, "Total_NG", "合計不良", "auto");
  }

  addFieldItem(quantityItems, processedKeys, draft, "Total", "合計数量", "auto");
  pushSection(sections, "quantity", "数量・不良", "bar_chart", quantityItems);

  const otherItems = [];
  addFieldItem(otherItems, processedKeys, draft, "材料ロット", "材料ロット");
  addFieldItem(otherItems, processedKeys, draft, "製造ロット", "製造ロット");
  addFieldItem(otherItems, processedKeys, draft, "Comment", "コメント", "textarea");
  pushSection(sections, "other", "その他", "notes", otherItems);

  const imageItems = [];
  Object.keys(draft)
    .sort((leftKey, rightKey) => leftKey.localeCompare(rightKey, "ja"))
    .forEach((key) => {
      if (processedKeys.has(key) || APPROVAL_EDIT_HIDDEN_FIELDS.has(key)) return;
      if (!isImageLikeKey(key)) return;

      processedKeys.add(key);
      const value = draft[key];
      imageItems.push({
        kind: Array.isArray(value) || isPlainObject(value) ? "structured" : "field",
        path: key,
        label: key,
        span: "full",
      });
    });
  pushSection(sections, "images", "画像", "image", imageItems);

  const extraScalarItems = [];
  const extraStructuredItems = [];

  Object.keys(draft)
    .sort((leftKey, rightKey) => leftKey.localeCompare(rightKey, "ja"))
    .forEach((key) => {
      if (processedKeys.has(key) || APPROVAL_EDIT_HIDDEN_FIELDS.has(key)) return;

      const value = draft[key];
      processedKeys.add(key);

      if (Array.isArray(value) || isPlainObject(value)) {
        extraStructuredItems.push({ kind: "structured", path: key, label: key, span: "full" });
        return;
      }

      extraScalarItems.push({ kind: "field", path: key, label: key });
    });

  pushSection(sections, "extraFields", "追加フィールド", "list_alt", extraScalarItems);
  pushSection(sections, "extraStructured", "構造化データ", "dataset", extraStructuredItems);

  return sections;
}

export function resolveApprovalEditFieldKind(path, value) {
  const segments = String(path || "").split(".");
  const rootKey = segments[0] || "";
  const leafKey = segments[segments.length - 1] || "";

  if (typeof value === "boolean") return "boolean";
  if (APPROVAL_EDIT_AUTO_FIELDS.has(rootKey)) return "auto";
  if (APPROVAL_EDIT_TEXTAREA_FIELDS.has(rootKey)) return "textarea";
  if (rootKey === "Date" || leafKey === "Date") return "date";
  if (["Time_start", "Time_end", "start", "end"].includes(leafKey)) return "time";
  if (path.startsWith("Counters.")) return "integer";
  if (APPROVAL_EDIT_INTEGER_FIELDS.has(rootKey) || APPROVAL_EDIT_INTEGER_FIELDS.has(leafKey)) return "integer";
  if (APPROVAL_EDIT_NUMBER_FIELDS.has(rootKey) || APPROVAL_EDIT_NUMBER_FIELDS.has(leafKey)) return "number";

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
    if (/^\d{1,2}:\d{2}$/.test(value)) return "time";
    if (value.length > 120) return "textarea";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }

  return "text";
}

export function computeApprovalDerivedFields(draft = {}, collectionName) {
  if (!draft || typeof draft !== "object") return draft;

  let ngTotal = 0;

  if (collectionName === "kensaDB" && isPlainObject(draft.Counters)) {
    ngTotal = Object.values(draft.Counters).reduce((sum, value) => sum + normalizeInteger(value), 0);
    draft.Total_NG = ngTotal;
  } else if (collectionName === "SRSDB") {
    ngTotal = SRS_COUNTER_FIELDS.reduce((sum, key) => sum + normalizeInteger(draft[key]), 0);
    draft.SRS_Total_NG = ngTotal;
  } else {
    ngTotal = PRESS_COUNTER_FIELDS.reduce((sum, key) => sum + normalizeInteger(draft[key]), 0);
    draft.Total_NG = ngTotal;
  }

  const processQuantity = normalizeInteger(draft.Process_Quantity);
  draft.Total = Math.max(0, processQuantity - ngTotal);

  if (isPlainObject(draft.Break_Time_Data)) {
    const totalBreakMinutes = Object.values(draft.Break_Time_Data).reduce((sum, entry) => {
      const startMinutes = parseClockMinutes(entry?.start);
      const endMinutes = parseClockMinutes(entry?.end);
      if (startMinutes < 0 || endMinutes <= startMinutes) return sum;
      return sum + (endMinutes - startMinutes);
    }, 0);

    draft.Total_Break_Minutes = totalBreakMinutes;
    draft.Total_Break_Hours = roundToTwo(totalBreakMinutes / 60);
  }

  const startMinutes = parseClockMinutes(draft.Time_start);
  const endMinutes = parseClockMinutes(draft.Time_end);
  const breakHours = normalizeNumber(draft.Total_Break_Hours);
  const troubleHours = normalizeNumber(draft.Total_Trouble_Hours);

  if (startMinutes >= 0 && endMinutes > startMinutes) {
    draft.Total_Work_Hours = roundToTwo(Math.max(0, ((endMinutes - startMinutes) / 60) - breakHours - troubleHours));
  } else {
    draft.Total_Work_Hours = 0;
  }

  if (processQuantity > 0) {
    draft.Cycle_Time = roundToTwo((normalizeNumber(draft.Total_Work_Hours) * 3600) / processQuantity);
  } else {
    draft.Cycle_Time = 0;
  }

  if (Array.isArray(draft.materialLabelImages)) {
    const validImages = draft.materialLabelImages.filter(Boolean);
    draft.materialLabelImages = validImages;
    draft.materialLabelImageCount = validImages.length;
    if (validImages.length) {
      draft["材料ラベル画像"] = validImages[0];
    }
  }

  return draft;
}

export function flattenApprovalEditChanges(draft = {}) {
  const changes = {};

  function visit(path, value) {
    if (!path) return;
    const rootKey = path.split(".")[0];
    if (APPROVAL_EDIT_PROTECTED_FIELDS.has(rootKey)) return;
    if (value === undefined) return;

    if (Array.isArray(value)) {
      changes[path] = value;
      return;
    }

    if (isPlainObject(value)) {
      Object.entries(value).forEach(([key, nestedValue]) => {
        visit(`${path}.${key}`, nestedValue);
      });
      return;
    }

    changes[path] = value;
  }

  Object.entries(draft || {}).forEach(([key, value]) => visit(key, value));
  return changes;
}