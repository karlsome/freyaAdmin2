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

async function getJson(endpoint) {
  return requestJson(endpoint);
}

export async function postInventoryAction(action, payload = {}) {
  return postJson("api/inventory-management", { action, ...payload });
}

export async function fetchInventoryPage({ filters = {}, page = 1, limit = 10, sort = {} } = {}) {
  return postInventoryAction("getInventoryData", { filters, page, limit, sort });
}

export async function fetchInventoryFilterOptions() {
  const result = await postInventoryAction("getFilterOptions");
  return {
    partNumbers: Array.isArray(result?.data?.partNumbers) ? result.data.partNumbers : [],
    backNumbers: Array.isArray(result?.data?.backNumbers) ? result.data.backNumbers : [],
    factories: Array.isArray(result?.data?.factories) ? result.data.factories : [],
  };
}

export async function fetchInventoryTransactions(backNumber) {
  const result = await postInventoryAction("getItemTransactions", { 背番号: backNumber });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function resetInventoryItem(payload) {
  return postInventoryAction("resetInventory", payload);
}

export async function fetchInventoryBatchResetItems(filters = []) {
  const result = await postInventoryAction("getBatchResetItems", { filters });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function batchResetInventory(items, submittedBy, fullName) {
  return postInventoryAction("batchResetInventory", { items, submittedBy, fullName });
}

export async function exportInventoryData(filters = {}) {
  const result = await postInventoryAction("exportInventoryData", { filters });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function addInventoryStock(payload) {
  return postJson("api/inventory/add", payload);
}

export async function fetchInventoryModels() {
  const result = await getJson("api/masterdb/models");
  return Array.isArray(result?.data) ? result.data : [];
}

export async function fetchInventoryProducts(model = "") {
  const queryString = model ? `?model=${encodeURIComponent(model)}` : "";
  const result = await getJson(`api/masterdb/products${queryString}`);
  return Array.isArray(result?.data) ? result.data : [];
}

export async function lookupInventoryMasterData(criteria = {}) {
  const partNumber = String(criteria?.品番 || "").trim();
  const backNumber = String(criteria?.背番号 || "").trim();

  if (!partNumber && !backNumber) return null;

  const records = await query(
    "Sasaki_Coating_MasterDB",
    "masterDB",
    {
      ...(partNumber ? { 品番: partNumber } : {}),
      ...(backNumber ? { 背番号: backNumber } : {}),
    },
    {
      limit: 1,
      projection: { 品番: 1, 背番号: 1, 品名: 1, モデル: 1, 形状: 1, 色: 1, 工場: 1 },
    }
  );

  return Array.isArray(records) ? (records[0] || null) : null;
}

export async function resolveInventoryActorName(authUser = {}) {
  const localName = [authUser?.lastName, authUser?.firstName].filter(Boolean).join(" ").trim();
  if (localName) return localName;

  const username = String(authUser?.username || "").trim();
  if (!username) return "Unknown";

  try {
    const users = await query(
      "Sasaki_Coating_MasterDB",
      "users",
      { username },
      { limit: 1, projection: { firstName: 1, lastName: 1, username: 1 } }
    );

    const user = Array.isArray(users) ? users[0] : null;
    const resolved = [user?.lastName, user?.firstName].filter(Boolean).join(" ").trim();
    return resolved || username;
  } catch {
    return username;
  }
}