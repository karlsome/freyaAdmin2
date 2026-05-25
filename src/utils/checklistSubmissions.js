export const CHECKLIST_SUBMISSION_OPERATOR_LABELS = {
  equals: "Equals",
  contains: "Contains",
  in: "In",
  greater: "Greater than",
  less: "Less than",
  range: "Range",
};

export const CHECKLIST_SUBMISSION_SCHEDULE_OPTIONS = ["Daily", "Weekly", "Monthly"];
export const CHECKLIST_SUBMISSION_NG_OPTIONS = ["With NG", "Without NG"];
export const CHECKLIST_SUBMISSION_ACTIVITY_OPTIONS = ["Has submissions", "No submissions"];

export const CHECKLIST_SUBMISSION_ADVANCED_FILTER_FIELDS = [
  { field: "keyword", label: "Keyword", group: "Search", type: "text", operators: ["contains"] },
  { field: "factory", label: "Factory", group: "Scope", type: "select", operators: ["equals", "contains", "in"] },
  { field: "machineLabel", label: "Machine", group: "Machine", type: "select", operators: ["equals", "contains", "in"] },
  { field: "formName", label: "Checklist Form", group: "Form", type: "select", operators: ["equals", "contains", "in"] },
  { field: "schedule", label: "Schedule", group: "Form", type: "select", operators: ["equals", "in"], options: CHECKLIST_SUBMISSION_SCHEDULE_OPTIONS },
  { field: "completedBy", label: "Submitted By", group: "Submission", type: "select", operators: ["equals", "contains", "in"] },
  { field: "hasNGStatus", label: "NG Status", group: "Submission", type: "select", operators: ["equals", "in"], options: CHECKLIST_SUBMISSION_NG_OPTIONS },
  { field: "submissionActivity", label: "Submission Activity", group: "Submission", type: "select", operators: ["equals", "in"], options: CHECKLIST_SUBMISSION_ACTIVITY_OPTIONS },
  { field: "recordCount", label: "Submission Count", group: "Submission", type: "number", operators: ["equals", "greater", "less", "range"] },
  { field: "lastCompletedAt", label: "Last Submission Date", group: "Submission", type: "date", operators: ["equals", "greater", "less", "range"] },
];

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