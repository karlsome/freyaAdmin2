import { BASE_URL } from "./api";

async function parseJsonResponse(response, fallbackMessage) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        payload?.details ||
        `${fallbackMessage} (HTTP ${response.status})`
    );
  }

  return payload;
}

export async function fetchFreyaTabletData({
  page = 1,
  limit = 10,
  sortField = "Date",
  sortDirection = -1,
  equipment = "",
  dateFrom = "",
  dateTo = "",
  search = "",
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortField: String(sortField || "Date"),
    sortDirection: String(
      sortDirection === "asc" || sortDirection === 1 ? 1 : -1
    ),
  });

  if (equipment) params.append("equipment", equipment);
  if (dateFrom) params.append("dateFrom", dateFrom);
  if (dateTo) params.append("dateTo", dateTo);
  if (search) params.append("search", search);

  const response = await fetch(`${BASE_URL}api/freya-tablet-data?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  return parseJsonResponse(response, "Failed to fetch Freya Tablet production records");
}

export async function fetchFreyaTabletEquipmentOptions() {
  const response = await fetch(`${BASE_URL}api/freya-tablet-equipment-options`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const payload = await parseJsonResponse(response, "Failed to fetch equipment options");
  return Array.isArray(payload?.data) ? payload.data.filter(Boolean) : [];
}

export async function fetchWorkOrders({
  filters = {},
  page = 1,
  limit = 10,
  sort = { column: "Date and time", direction: -1 },
} = {}) {
  const statusVal = filters.status || filters.Status || "";
  const customerVal = filters.customer || filters["Customer-Custom fields"] || "";
  const assignToVal = filters.assignTo || filters["Assign to-Custom fields"] || "";
  const sortField = sort.column || sort.field || "Date and time";
  const sortDirNumeric =
    sort.direction === "asc" || sort.direction === 1 ? 1 : -1;

  const formattedFilters = {
    status: statusVal,
    Status: statusVal || undefined,
    customer: customerVal,
    "Customer-Custom fields": customerVal || undefined,
    assignTo: assignToVal,
    "Assign to-Custom fields": assignToVal || undefined,
    dateRange:
      filters.dateFrom || filters.dateTo
        ? {
            from: filters.dateFrom || undefined,
            to: filters.dateTo || undefined,
          }
        : filters.dateRange || undefined,
    search: filters.search || "",
  };

  const response = await fetch(`${BASE_URL}api/workorders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getWorkOrders",
      filters: formattedFilters,
      page,
      limit,
      sort: {
        field: sortField,
        column: sortField,
        direction: sortDirNumeric,
      },
    }),
  });

  return parseJsonResponse(response, "Failed to fetch SCNA work orders");
}

export async function fetchWorkOrderById(workOrderId) {
  const response = await fetch(`${BASE_URL}api/workorders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getWorkOrderById",
      workOrderId,
    }),
  });

  const payload = await parseJsonResponse(response, "Failed to fetch work order details");
  return payload?.data || null;
}

export async function fetchWorkOrderAssignees() {
  const response = await fetch(`${BASE_URL}api/workorders/assignees`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const payload = await parseJsonResponse(response, "Failed to fetch work order assignees");
  return Array.isArray(payload?.data) ? payload.data.filter(Boolean) : [];
}

export async function updateWorkOrder(workOrderId, { data, username }) {
  const response = await fetch(`${BASE_URL}api/workorders/${encodeURIComponent(workOrderId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, username }),
  });

  return parseJsonResponse(response, "Failed to update work order");
}

export async function bulkUploadWorkOrders({
  workOrders,
  username,
  overwrite = false,
}) {
  const response = await fetch(`${BASE_URL}api/workorders/bulk-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workOrders,
      username,
      overwrite,
    }),
  });

  return parseJsonResponse(response, "Failed to upload work orders JSON");
}

export async function fetchScnaMachineAnalytics({
  dateFrom,
  dateTo,
  machine = "all",
} = {}) {
  const response = await fetch(`${BASE_URL}api/scna/machine-analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dateFrom,
      dateTo,
      machine,
    }),
  });

  return parseJsonResponse(response, "Failed to fetch SCNA machine analytics");
}

export async function fetchScnaMachines() {
  const response = await fetch(`${BASE_URL}api/scna/machines`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const payload = await parseJsonResponse(response, "Failed to fetch SCNA machines");
  return Array.isArray(payload?.data) ? payload.data.filter(Boolean) : [];
}

