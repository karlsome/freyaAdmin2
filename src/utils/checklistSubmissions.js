export const CHECKLIST_SUBMISSION_OPERATOR_LABELS = {
  equals: "Equals",
  contains: "Contains",
  in: "In",
  greater: "Greater than",
  less: "Less than",
  range: "Range",
};

export const CHECKLIST_SUBMISSION_ADVANCED_FILTER_FIELDS = [
  { field: "factory", label: "Factory", group: "Scope", type: "select", operators: ["equals", "contains", "in"] },
  { field: "machineLabel", label: "Machine", group: "Machine", type: "select", operators: ["equals", "contains", "in"] },
  { field: "formName", label: "Checklist Form", group: "Form", type: "select", operators: ["equals", "contains", "in"] },
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

function matchesChecklistSubmissionClause(item, clause) {
  const itemValue = item?.[clause.field];

  if (clause.operator === "range") {
    const candidate = normalizeComparableValue(itemValue, clause.type);
    const valueFrom = normalizeComparableValue(clause.valueFrom, clause.type);
    const valueTo = normalizeComparableValue(clause.valueTo, clause.type);

    if (candidate == null || valueFrom == null || valueTo == null) return false;

    const minimum = Math.min(valueFrom, valueTo);
    const maximum = Math.max(valueFrom, valueTo);
    return candidate >= minimum && candidate <= maximum;
  }

  if (clause.operator === "in") {
    const candidate = normalizeComparableValue(itemValue, clause.type);
    if (candidate == null) return false;

    return clause.value.some((value) => normalizeComparableValue(value, clause.type) === candidate);
  }

  if (clause.operator === "contains") {
    return normalizeComparableValue(itemValue, "text")
      .includes(normalizeComparableValue(clause.value, "text"));
  }

  if (clause.operator === "greater") {
    const candidate = normalizeComparableValue(itemValue, clause.type);
    const comparison = normalizeComparableValue(clause.value, clause.type);
    return candidate != null && comparison != null && candidate > comparison;
  }

  if (clause.operator === "less") {
    const candidate = normalizeComparableValue(itemValue, clause.type);
    const comparison = normalizeComparableValue(clause.value, clause.type);
    return candidate != null && comparison != null && candidate < comparison;
  }

  return normalizeComparableValue(itemValue, clause.type) === normalizeComparableValue(clause.value, clause.type);
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