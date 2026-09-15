import { FILTER_SCHEMA } from "../ProductionFilterBar";

export const ANALYTICS_FILTER_SCHEMA = FILTER_SCHEMA.map((fieldDef) => {
  if (fieldDef.field === "品番") {
    return {
      ...fieldDef,
      operators: ["equals", "not_equals", "in", "contains", "exists", "not_exists"],
    };
  }
  return fieldDef;
});

export const OPERATOR_LABELS = {
  equals: "= equals",
  not_equals: "≠ is not",
  contains: "contains",
  in: "in",
  range: "↔ between",
  exists: "exists",
  not_exists: "does not exist",
  greater_than: "> greater than",
  less_than: "< less than",
};

export const OPERATOR_LABELS_JA = {
  equals: "= 一致",
  not_equals: "≠ 不一致",
  contains: "含む",
  in: "いずれかに一致",
  range: "↔ 範囲指定",
  exists: "存在する",
  not_exists: "存在しない",
  greater_than: "> より大きい",
  less_than: "< より小さい",
};

let _rowCounter = 0;
export function createNewFilterRow() {
  return { id: ++_rowCounter, field: "", operator: "equals", value: "" };
}

export function buildAnalyticsFilterClauses(rows = [], fieldDefinitions = []) {
  const fieldMap = Object.fromEntries(fieldDefinitions.map((f) => [f.field, f]));
  const clauses = [];

  rows.forEach((row) => {
    if (!row?.field || !row?.operator) return;
    const def = fieldMap[row.field];
    const isNum = def?.type === "number";

    const parseVal = (v) => {
      if (v === "" || v === undefined || v === null) return null;
      if (Array.isArray(v)) {
        if (v.length === 0) return null;
        const mapped = v
          .map((item) => (isNum ? Number(item) : item))
          .filter((item) => item !== "" && item !== undefined && item !== null);
        return mapped.length === 1 ? mapped[0] : mapped;
      }
      return isNum ? Number(v) : v;
    };

    if (row.operator === "equals") {
      const v = parseVal(row.value);
      if (v !== null) {
        if (Array.isArray(v)) {
          if (v.length === 1) clauses.push({ [row.field]: v[0] });
          else if (v.length > 1) clauses.push({ [row.field]: { $in: v } });
        } else {
          clauses.push({ [row.field]: v });
        }
      }
    } else if (row.operator === "not_equals") {
      const v = parseVal(row.value);
      if (v !== null) {
        if (Array.isArray(v)) {
          if (v.length === 1) clauses.push({ [row.field]: { $ne: v[0] } });
          else if (v.length > 1) clauses.push({ [row.field]: { $nin: v } });
        } else {
          clauses.push({ [row.field]: { $ne: v } });
        }
      }
    } else if (row.operator === "contains") {
      const raw = Array.isArray(row.value) ? row.value[0] : row.value;
      if (raw) {
        clauses.push({
          [row.field]: {
            $regex: String(raw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        });
      }
    } else if (row.operator === "in") {
      const rawArr = Array.isArray(row.value)
        ? row.value
        : String(row.value || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      const flat = rawArr.flat().filter((v) => v !== "" && v !== undefined && v !== null);
      if (flat.length > 0) {
        clauses.push({ [row.field]: { $in: flat.map((x) => (isNum ? Number(x) : x)) } });
      }
    } else if (row.operator === "greater_than" || row.operator === "greater") {
      const raw = Array.isArray(row.value) ? row.value[0] : row.value;
      const v = parseVal(raw);
      if (v !== null) clauses.push({ [row.field]: { $gt: v } });
    } else if (row.operator === "less_than" || row.operator === "less") {
      const raw = Array.isArray(row.value) ? row.value[0] : row.value;
      const v = parseVal(raw);
      if (v !== null) clauses.push({ [row.field]: { $lt: v } });
    } else if (row.operator === "range") {
      const rawFrom = Array.isArray(row.valueFrom) ? row.valueFrom[0] : row.valueFrom;
      const rawTo = Array.isArray(row.valueTo) ? row.valueTo[0] : row.valueTo;
      const vFrom = parseVal(rawFrom);
      const vTo = parseVal(rawTo);
      const rangeCond = {};
      if (vFrom !== null) rangeCond.$gte = vFrom;
      if (vTo !== null) rangeCond.$lte = vTo;
      if (Object.keys(rangeCond).length > 0) {
        clauses.push({ [row.field]: rangeCond });
      }
    } else if (row.operator === "exists") {
      clauses.push({ [row.field]: { $exists: true, $nin: ["", null] } });
    } else if (row.operator === "not_exists") {
      clauses.push({
        $or: [{ [row.field]: { $exists: false } }, { [row.field]: "" }, { [row.field]: null }],
      });
    }
  });

  return clauses;
}
