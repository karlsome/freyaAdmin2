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


const GATEKEEPER_DB = "Sasaki_Coating_MasterDB";
const GATEKEEPER_COLLECTION = "gatekeeperSettingDB";

async function postQuery(body) {
  const response = await fetch(`${BASE_URL}queries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dbName: GATEKEEPER_DB, collectionName: GATEKEEPER_COLLECTION, ...body }),
  });
  return response;
}

export async function fetchGatekeeperSettings() {
  const response = await postQuery({ query: {} });
  const payload = await parseJsonResponse(response, "Failed to fetch gatekeeper settings");
  return Array.isArray(payload) ? payload : [];
}

export async function setGatekeeperEnabled({ factory, machine, enabled, username }) {
  const record = {
    factory,
    machine,
    enabled: Boolean(enabled),
    updatedAt: new Date().toISOString(),
    updatedBy: username || "admin",
  };

  const updateResponse = await postQuery({
    query: { factory, machine },
    update: { $set: record },
  });
  if (updateResponse.status === 404) {
    const insertResponse = await postQuery({ insertData: record });
    await parseJsonResponse(insertResponse, "Failed to create gatekeeper setting");
  } else {
    await parseJsonResponse(updateResponse, "Failed to update gatekeeper setting");
  }
  return record;
}

// ─── NC programs (PLT → JSON points, sent to the CNC by the miniPC listener) ───
export async function fetchScnaNcProgramCounts() {
  const response = await fetch(`${BASE_URL}api/scna-nc-programs/counts`);
  return parseJsonResponse(response, "Failed to fetch NC program counts");
}

export async function fetchScnaNcPrograms(sebanggo) {
  const response = await fetch(
    `${BASE_URL}api/scna-nc-programs/by-sebanggo/${encodeURIComponent(sebanggo)}`
  );
  const payload = await parseJsonResponse(response, "Failed to fetch NC programs");
  return Array.isArray(payload) ? payload : [];
}

export async function uploadScnaNcProgram({ sebanggo, displayName, fileName, sourceType, pltBase64, pceBase64, points, uploadedBy }) {
  const response = await fetch(`${BASE_URL}api/scna-nc-programs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sebanggo, displayName, fileName, sourceType, pltBase64, pceBase64, points, uploadedBy }),
  });
  return parseJsonResponse(response, "Failed to upload NC program");
}

export async function fetchScnaNcProgramPoints(id) {
  const response = await fetch(`${BASE_URL}api/scna-nc-programs/${encodeURIComponent(id)}/points`);
  const payload = await parseJsonResponse(response, "Failed to fetch NC program points");
  return Array.isArray(payload?.points) ? payload.points : [];
}

export async function renameScnaNcProgram(id, displayName) {
  const response = await fetch(`${BASE_URL}api/scna-nc-programs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  return parseJsonResponse(response, "Failed to rename NC program");
}

export async function deleteScnaNcProgram(id) {
  const response = await fetch(`${BASE_URL}api/scna-nc-programs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return parseJsonResponse(response, "Failed to delete NC program");
}

// ─── Label layouts (designed here, rendered by the miniPC print server) ───────
export async function fetchScnaLabelLayouts() {
  const response = await fetch(`${BASE_URL}api/scna-label-layouts`);
  const payload = await parseJsonResponse(response, "Failed to fetch label layouts");
  return Array.isArray(payload) ? payload : [];
}

export async function createScnaLabelLayout({ name, customers, isDefault, layout, username }) {
  const response = await fetch(`${BASE_URL}api/scna-label-layouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, customers, isDefault, layout, username }),
  });
  return parseJsonResponse(response, "Failed to create label layout");
}

export async function updateScnaLabelLayout(layoutId, { name, customers, isDefault, layout, username }) {
  const response = await fetch(`${BASE_URL}api/scna-label-layouts/${encodeURIComponent(layoutId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, customers, isDefault, layout, username }),
  });
  return parseJsonResponse(response, "Failed to update label layout");
}

export async function deleteScnaLabelLayout(layoutId) {
  const response = await fetch(`${BASE_URL}api/scna-label-layouts/${encodeURIComponent(layoutId)}`, {
    method: "DELETE",
  });
  return parseJsonResponse(response, "Failed to delete label layout");
}

// Field display names: every field found on SCNA masterDB items + saved English/Japanese names.
export async function fetchScnaLabelFields() {
  const response = await fetch(`${BASE_URL}api/scna-label-fields`);
  const payload = await parseJsonResponse(response, "Failed to fetch label fields");
  return {
    fields: Array.isArray(payload?.fields) ? payload.fields : [],
    names: Array.isArray(payload?.names) ? payload.names : [],
  };
}

export async function saveScnaLabelFieldNames({ names, username }) {
  const response = await fetch(`${BASE_URL}api/scna-label-fields`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ names, username }),
  });
  return parseJsonResponse(response, "Failed to save field names");
}

// Item binding for label layouts (writes masterDB.labelLayoutId on SCNA items).
export async function fetchScnaLabelItems() {
  const response = await fetch(`${BASE_URL}api/scna-label-layouts/items`);
  const payload = await parseJsonResponse(response, "Failed to fetch items");
  return Array.isArray(payload) ? payload : [];
}

export async function assignScnaLabelLayoutItems(layoutId, { add, remove }) {
  const response = await fetch(`${BASE_URL}api/scna-label-layouts/${encodeURIComponent(layoutId)}/assign`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ add, remove }),
  });
  return parseJsonResponse(response, "Failed to assign items");
}

export async function migrateScnaLabelCustomers({ dryRun = false } = {}) {
  const response = await fetch(`${BASE_URL}api/scna-label-layouts/migrate-customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dryRun }),
  });
  return parseJsonResponse(response, "Failed to migrate customer bindings");
}

// Preview PNG (data URL) rendered when a layout is saved; the server stores it in Firebase Storage.
export async function saveScnaLabelThumbnail(layoutId, imageBase64) {
  const response = await fetch(`${BASE_URL}api/scna-label-layouts/${encodeURIComponent(layoutId)}/thumbnail`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });
  return parseJsonResponse(response, "Failed to save label thumbnail");
}

export async function fetchScnaBox(boxId) {
  const response = await fetch(
    `${BASE_URL}api/scna-boxes/${encodeURIComponent(boxId)}`,
    { method: "GET", headers: { "Content-Type": "application/json" } }
  );
  if (response.status === 404) return null;
  return parseJsonResponse(response, "Failed to fetch box");
}

export async function fetchScnaBoxesByLot(lotNumber) {
  const response = await fetch(
    `${BASE_URL}api/scna-boxes?lotNumber=${encodeURIComponent(lotNumber)}`,
    { method: "GET", headers: { "Content-Type": "application/json" } }
  );
  const payload = await parseJsonResponse(response, "Failed to search boxes by lot");
  return Array.isArray(payload) ? payload : [];
}
