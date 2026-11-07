/**
 * User management API — same endpoints as the legacy FreyaAdmin user management page.
 *   users:   /queries (Sasaki_Coating_MasterDB.users), /createUser, /updateUser, /resetPassword
 *   workers: /queries (Sasaki_Coating_MasterDB.workerDB), /createWorker, /updateWorker, /deleteWorker
 */
import { BASE_URL, query } from "./api";

const DB_NAME = "Sasaki_Coating_MasterDB";

export const USER_ROLES = ["admin", "部長", "課長", "係長", "班長", "member"];
export const FALLBACK_FACTORIES = ["第一工場", "第二工場", "肥田瀬", "天徳", "倉知", "小瀬", "SCNA", "NFH"];

async function post(endpoint, body) {
  const res = await fetch(BASE_URL + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data?.error || data?.message || `API ${res.status}`);
  return data;
}

export async function fetchUsers() {
  const rows = await query(DB_NAME, "users", {}, { projection: { password: 0 } });
  return Array.isArray(rows) ? rows : [];
}

export async function fetchWorkers() {
  const rows = await query(DB_NAME, "workerDB", {}, { projection: {} });
  return Array.isArray(rows) ? rows : [];
}

export async function fetchFactoryOptions() {
  try {
    const rows = await query(DB_NAME, "masterDB", {}, { projection: { 工場: 1 } });
    const names = [...new Set((rows || []).map((r) => r.工場).filter(Boolean))].sort();
    return names.length ? names : FALLBACK_FACTORIES;
  } catch {
    return FALLBACK_FACTORIES;
  }
}

export const createUser = (body) => post("createUser", body);
export const updateUser = (body) => post("updateUser", body);
export const resetUserPassword = (userId, newPassword) => post("resetPassword", { userId, newPassword });

/** Archives the user (same call as legacy). Resolves to the server result. */
export async function archiveUser(userId, username) {
  const result = await post("queries", {
    dbName: DB_NAME,
    collectionName: "users",
    query: { _id: userId },
    delete: true,
    username,
  });
  if (!(result.deletedFromOriginal > 0)) throw new Error("No user archived. Check if the user still exists.");
  return result;
}

export const createWorker = (body) => post("createWorker", body);
export const updateWorker = (body) => post("updateWorker", body);
export const deleteWorker = (workerId) => post("deleteWorker", { workerId });
