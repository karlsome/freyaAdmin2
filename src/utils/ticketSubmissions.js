export const TICKET_SUBMISSION_OPERATOR_LABELS = {
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

export const TICKET_SUBMISSION_IMAGE_OPTIONS = ["With Images", "Without Images"];
export const TICKET_SUBMISSION_PAGE_SIZE_OPTIONS = [10, 50, 100];

export const EMPTY_TICKET_SUMMARY = {
  totalTickets: 0,
  imageTickets: 0,
  recordCount: 0,
  machineCount: 0,
  operatorCount: 0,
};

export const TICKET_SUBMISSION_ADVANCED_FILTER_FIELDS = [
  { field: "keyword", label: "Keyword", group: "Search", type: "text", operators: ["contains"] },
  { field: "factory", label: "Factory", group: "Scope", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "machineName", label: "Machine", group: "Scope", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "formName", label: "Checklist Form", group: "Submission", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "completedBy", label: "Submitted By", group: "Submission", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "status", label: "Ticket Status", group: "Ticket", type: "select", operators: ["equals", "not_equals", "in", "exists", "not_exists"] },
  { field: "fieldLabel", label: "Check Item", group: "Ticket", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "fieldType", label: "Field Type", group: "Ticket", type: "select", operators: ["equals", "not_equals", "contains", "in", "exists", "not_exists"] },
  { field: "answerValue", label: "Submitted Value", group: "Ticket", type: "text", operators: ["equals", "not_equals", "contains", "exists", "not_exists"] },
  { field: "hasImages", label: "Image Evidence", group: "Ticket", type: "select", operators: ["equals", "not_equals", "in"], options: TICKET_SUBMISSION_IMAGE_OPTIONS },
  { field: "imageCount", label: "Image Count", group: "Ticket", type: "number", operators: ["equals", "not_equals", "greater", "less", "range", "exists", "not_exists"] },
  { field: "createdAt", label: "Ticket Date", group: "Ticket", type: "date", operators: ["equals", "not_equals", "greater", "less", "range", "exists", "not_exists"] },
];

let ticketSubmissionFilterRowCount = 0;

function asTrimmedString(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function createTicketSubmissionFilterRow() {
  ticketSubmissionFilterRowCount += 1;

  return {
    id: `ticket-submission-filter-${Date.now()}-${ticketSubmissionFilterRowCount}`,
    field: "",
    operator: "",
    value: "",
    valueFrom: "",
    valueTo: "",
  };
}

export function buildTicketSubmissionAdvancedFilterClauses(rows = [], fieldDefinitions = []) {
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

export function buildTicketSubmissionPageInfo({ filteredCount, page, pageSize }) {
  if (!filteredCount) return "0 tickets shown";

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, filteredCount);

  return `${filteredCount.toLocaleString()} tickets, showing ${start.toLocaleString()}-${end.toLocaleString()}`;
}

export function formatTicketNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString() : "0";
}

export function formatTicketDateTime(value) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTicketStatusLabel(value) {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) return "Open";

  return normalizedValue
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatTicketRange(ticket) {
  if (ticket?.min !== null && ticket?.min !== undefined && ticket?.max !== null && ticket?.max !== undefined) {
    return `${ticket.min} to ${ticket.max}${ticket.unit ? ` ${ticket.unit}` : ""}`;
  }

  if (ticket?.min !== null && ticket?.min !== undefined) {
    return `>= ${ticket.min}${ticket.unit ? ` ${ticket.unit}` : ""}`;
  }

  if (ticket?.max !== null && ticket?.max !== undefined) {
    return `<= ${ticket.max}${ticket.unit ? ` ${ticket.unit}` : ""}`;
  }

  return "OK";
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function buildTicketSubmissionExportMatrix(rows = []) {
  return [
    [
      "Submitted At",
      "Factory",
      "Machine",
      "Checklist Form",
      "Check Item",
      "Field Type",
      "Submitted Value",
      "Allowed Range",
      "Reason",
      "Submitted By",
      "Status",
      "Record ID",
      "Image Count",
      "Image URLs",
    ],
    ...rows.map((row) => ([
      formatTicketDateTime(row.createdAt),
      row.factory || "",
      row.machineName || "",
      row.formName || "",
      row.fieldLabel || "",
      row.fieldType || "",
      row.answerValue || "",
      formatTicketRange(row),
      row.reason || "",
      row.completedBy || "",
      formatTicketStatusLabel(row.status),
      row.recordId || "",
      Number(row.imageCount ?? row.imageURLs?.length ?? 0) || 0,
      Array.isArray(row.imageURLs) ? row.imageURLs.join(" | ") : "",
    ])),
  ];
}

export function downloadTicketCsvFile(fileName, rows = []) {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}