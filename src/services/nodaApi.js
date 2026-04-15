import { query } from "./api";

const LOCAL_URL = "http://localhost:3000/";
const ENV_URL = import.meta.env.VITE_API_URL?.trim();
const BASE_URL = (ENV_URL || LOCAL_URL).replace(/\/?$/, "/");

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson(endpoint, options = {}) {
  const response = await fetch(BASE_URL + endpoint, options);
  const data = await readJson(response);

  if (!response.ok) {
    const message = typeof data === "string"
      ? data
      : data?.error || data?.message || `API ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function postJson(endpoint, body) {
  return requestJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getNodaApiBaseUrl() {
  return BASE_URL;
}

export async function postNodaAction(action, payload = {}) {
  return postJson("api/noda-requests", { action, ...payload });
}

export async function fetchNodaPage({ filters = {}, page = 1, limit = 10, sort = {} } = {}) {
  return postNodaAction("getNodaRequests", { filters, page, limit, sort });
}

export async function fetchNodaFilterOptions() {
  const result = await postNodaAction("getFilterOptions");
  return {
    partNumbers: Array.isArray(result?.data?.partNumbers) ? result.data.partNumbers : [],
    backNumbers: Array.isArray(result?.data?.backNumbers) ? result.data.backNumbers : [],
  };
}

export async function fetchNodaRequest(requestId) {
  const result = await postNodaAction("getRequestById", { requestId });
  return result?.data || null;
}

export async function createNodaRequest(data) {
  return postNodaAction("createRequest", { data });
}

export async function updateNodaRequest(requestId, data) {
  return postNodaAction("updateRequest", { requestId, data });
}

export async function deleteNodaRequest(requestId, userName) {
  return postNodaAction("deleteRequest", { requestId, userName });
}

export async function bulkCreateNodaRequests(data, userName) {
  return postNodaAction("bulkCreateRequests", { data, userName });
}

export async function addItemsToNodaRequest(requestId, items, userName) {
  return postNodaAction("addItemsToRequest", {
    requestId,
    data: { items },
    userName,
  });
}

export async function updateNodaLineItemStatus(requestId, lineNumber, status) {
  return postNodaAction("updateLineItemStatus", {
    requestId,
    data: { lineNumber, status },
  });
}

export async function updateNodaLineItemQuantity(requestId, data, userName) {
  return postNodaAction("updateLineItemQuantity", { requestId, data, userName });
}

export async function deleteNodaLineItem(requestId, data, userName) {
  return postNodaAction("deleteLineItem", { requestId, data, userName });
}

export async function lookupNodaMasterData(criteria = {}) {
  return postNodaAction("lookupMasterData", criteria);
}

export async function checkNodaInventory(serialNumber) {
  return postNodaAction("checkInventory", { 背番号: serialNumber });
}

export async function exportNodaRequests(filters = {}) {
  const result = await postNodaAction("exportRequests", { filters });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function checkNodaDuplicateRequest({ deliveryNote, deliveryOrder, deadlineDate }) {
  return postNodaAction("checkDuplicateRequest", { deliveryNote, deliveryOrder, deadlineDate });
}

export async function runNodaInventoryReservation(userName) {
  return postNodaAction("autoCheckInventory", { userName });
}

export async function fetchNodaUserFullName(username) {
  const normalizedUsername = String(username || "").trim();
  if (!normalizedUsername) return "Unknown User";

  try {
    const users = await query(
      "Sasaki_Coating_MasterDB",
      "users",
      { username: normalizedUsername },
      { limit: 1, projection: { firstName: 1, lastName: 1, username: 1 } },
    );

    const user = Array.isArray(users) ? users[0] : null;
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    return fullName || normalizedUsername;
  } catch {
    return normalizedUsername;
  }
}

export async function fetchMasterRecordBySerialForGen(serialNumber) {
  const rows = await query(
    "Sasaki_Coating_MasterDB",
    "masterDB",
    { 背番号: serialNumber, pickingIOT: "yes" },
    { limit: 1 },
  );

  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function fetchNodaBulkRequestsByPickupDate(deliveryDate) {
  const rows = await query(
    "submittedDB",
    "nodaRequestDB",
    { pickupDate: deliveryDate, requestType: "bulk" },
    { limit: 1000 },
  );

  return Array.isArray(rows) ? rows : [];
}

export async function fetchGenCsvBuffer(deliveryDate) {
  const response = await fetch(BASE_URL + "extract-tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromDate: deliveryDate,
      toDate: deliveryDate,
      workerFilter: "gen_all",
    }),
  });

  if (!response.ok) {
    const data = await readJson(response);
    const message = typeof data === "string"
      ? data
      : data?.error || data?.message || `API ${response.status}`;
    throw new Error(message);
  }

  return response.arrayBuffer();
}