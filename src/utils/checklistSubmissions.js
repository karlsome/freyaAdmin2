export function getChecklistSubmissionOperatorLabels(isJa = false) {
  if (isJa) {
    return {
      equals: "一致する (=)",
      not_equals: "一致しない (≠)",
      contains: "含む",
      in: "いずれかを含む (複数選択)",
      exists: "値が存在する",
      not_exists: "値が存在しない (未入力)",
      greater: "より大きい (>)",
      less: "より小さい (<)",
      range: "範囲内 (From - To)",
    };
  }
  return {
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
}

export const CHECKLIST_SUBMISSION_OPERATOR_LABELS = getChecklistSubmissionOperatorLabels(false);

export const CHECKLIST_SUBMISSION_SCHEDULE_OPTIONS = ["Daily", "Weekly", "Monthly"];
export const CHECKLIST_SUBMISSION_NG_OPTIONS = ["With NG", "Without NG"];
export const CHECKLIST_SUBMISSION_ACTIVITY_OPTIONS = ["Has submissions", "No submissions"];

export function getChecklistSubmissionAdvancedFilterFields(isJa = false) {
  return [
    { field: "keyword", label: isJa ? "キーワード" : "Keyword", group: isJa ? "検索" : "Search", type: "text", operators: ["contains"] },
    { field: "factory", label: isJa ? "工場" : "Factory", group: isJa ? "対象範囲" : "Scope", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
    { field: "machineLabel", label: isJa ? "設備" : "Machine", group: isJa ? "設備" : "Machine", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
    { field: "formName", label: isJa ? "点検フォーム" : "Checklist Form", group: isJa ? "フォーム" : "Form", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
    { field: "schedule", label: isJa ? "周期" : "Schedule", group: isJa ? "フォーム" : "Form", type: "select", operators: ["equals", "not_equals", "in", "exists", "not_exists"], options: CHECKLIST_SUBMISSION_SCHEDULE_OPTIONS },
    { field: "completedBy", label: isJa ? "作業者 (提出者)" : "Submitted By", group: isJa ? "提出記録" : "Submission", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
    { field: "hasNGStatus", label: isJa ? "NG状態 (判定)" : "NG Status", group: isJa ? "提出記録" : "Submission", type: "select", operators: ["equals", "not_equals", "in"], options: CHECKLIST_SUBMISSION_NG_OPTIONS },
    { field: "submissionActivity", label: isJa ? "提出状況" : "Submission Activity", group: isJa ? "提出記録" : "Submission", type: "select", operators: ["equals", "not_equals", "in"], options: CHECKLIST_SUBMISSION_ACTIVITY_OPTIONS },
    { field: "recordCount", label: isJa ? "提出件数" : "Submission Count", group: isJa ? "提出記録" : "Submission", type: "number", operators: ["equals", "not_equals", "greater", "less", "range", "exists", "not_exists"] },
    { field: "lastCompletedAt", label: isJa ? "最終提出日" : "Last Submission Date", group: isJa ? "提出記録" : "Submission", type: "date", operators: ["equals", "not_equals", "greater", "less", "range", "exists", "not_exists"] },
  ];
}

export const CHECKLIST_SUBMISSION_ADVANCED_FILTER_FIELDS = getChecklistSubmissionAdvancedFilterFields(false);

let checklistSubmissionFilterRowCount = 0;

function asTrimmedString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeComparableValue(value, type) {
  if (type === "number") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  if (type === "date") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
  }

  return asTrimmedString(value).toLowerCase();
}

function normalizeComparableValues(value, type) {
  const rawValues = Array.isArray(value) ? value : [value];

  return rawValues
    .map((entry) => normalizeComparableValue(entry, type))
    .filter((entry) => entry != null && entry !== "");
}

function matchesChecklistSubmissionClause(item, clause) {
  const itemValue = item?.[clause.field];
  const candidates = normalizeComparableValues(itemValue, clause.type);

  if (clause.operator === "range") {
    const valueFrom = normalizeComparableValue(clause.valueFrom, clause.type);
    const valueTo = normalizeComparableValue(clause.valueTo, clause.type);

    if (!candidates.length || valueFrom == null || valueTo == null) return false;

    const minimum = Math.min(valueFrom, valueTo);
    const maximum = Math.max(valueFrom, valueTo);
    return candidates.some((candidate) => candidate >= minimum && candidate <= maximum);
  }

  if (clause.operator === "in") {
    if (!candidates.length) return false;

    return candidates.some((candidate) => (
      clause.value.some((value) => normalizeComparableValue(value, clause.type) === candidate)
    ));
  }

  if (clause.operator === "contains") {
    const query = normalizeComparableValue(clause.value, "text");
    if (!query) return false;

    return normalizeComparableValues(itemValue, "text")
      .some((candidate) => candidate.includes(query));
  }

  if (clause.operator === "greater") {
    const comparison = normalizeComparableValue(clause.value, clause.type);
    return comparison != null && candidates.some((candidate) => candidate > comparison);
  }

  if (clause.operator === "less") {
    const comparison = normalizeComparableValue(clause.value, clause.type);
    return comparison != null && candidates.some((candidate) => candidate < comparison);
  }

  const comparison = normalizeComparableValue(clause.value, clause.type);
  return comparison != null && candidates.some((candidate) => candidate === comparison);
}

export function createChecklistSubmissionFilterRow() {
  checklistSubmissionFilterRowCount += 1;

  return {
    id: `checklist-submission-filter-${Date.now()}-${checklistSubmissionFilterRowCount}`,
    field: "",
    operator: "",
    value: "",
    valueFrom: "",
    valueTo: "",
  };
}

export function buildChecklistSubmissionAdvancedFilterClauses(rows = [], fieldDefinitions = []) {
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
      value: rawValue,
    }];
  });
}

export function matchesChecklistSubmissionAdvancedFilters(item = {}, clauses = []) {
  if (!Array.isArray(clauses) || clauses.length === 0) return true;

  const clausesByField = clauses.reduce((map, clause) => {
    const list = map.get(clause.field) ?? [];
    list.push(clause);
    map.set(clause.field, list);
    return map;
  }, new Map());

  return Array.from(clausesByField.values()).every((fieldClauses) => (
    fieldClauses.some((clause) => matchesChecklistSubmissionClause(item, clause))
  ));
}