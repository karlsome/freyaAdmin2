// NC programs for the non-SCNA AOL cutters (OZNC.., NCC01). Kurachi server.js /api/nc-programs.
import { BASE_URL } from "./api";

async function parseJson(response, fallbackMessage) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.error || payload?.details || `${fallbackMessage} (HTTP ${response.status})`);
  }
  return payload;
}

// -> { factory, allFactories, types: [{ machineType, heads, tableLength, machines: [{ name, 工場 }] }] }
export async function fetchNcMachineTypes(factory) {
  const qs = factory ? `?factory=${encodeURIComponent(factory)}` : "";
  return parseJson(await fetch(`${BASE_URL}api/nc-programs/machine-types${qs}`), "Failed to load machine types");
}

export async function fetchNcPrograms(sebanggo) {
  const payload = await parseJson(
    await fetch(`${BASE_URL}api/nc-programs/by-sebanggo/${encodeURIComponent(sebanggo)}`),
    "Failed to load NC programs"
  );
  return Array.isArray(payload) ? payload : [];
}

export async function fetchNcHistory({ sebanggo, machineType, machine }) {
  const qs = new URLSearchParams({ sebanggo, machineType });
  if (machine) qs.set("machine", machine);
  const payload = await parseJson(await fetch(`${BASE_URL}api/nc-programs/history?${qs}`), "Failed to load history");
  return Array.isArray(payload) ? payload : [];
}

export async function fetchNcProgramPoints(id) {
  return parseJson(await fetch(`${BASE_URL}api/nc-programs/${id}/points?any=1`), "Failed to load points");
}

export function ncProgramPceUrl(id) {
  return `${BASE_URL}api/nc-programs/${id}/pce`;
}

export async function uploadNcProgram(body) {
  return parseJson(
    await fetch(`${BASE_URL}api/nc-programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    "Failed to upload NC program"
  );
}

export async function restoreNcProgram(id, user) {
  return parseJson(
    await fetch(`${BASE_URL}api/nc-programs/${id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user }),
    }),
    "Failed to restore NC program"
  );
}

export async function removeNcProgram(id, user) {
  return parseJson(
    await fetch(`${BASE_URL}api/nc-programs/${id}?user=${encodeURIComponent(user || "admin")}`, { method: "DELETE" }),
    "Failed to remove NC program"
  );
}

// PCE Files tab: one PCE for many 背番号 x machine types. entries: [{ code, suffix }].
// A 409 throws an error with .isConflict and .conflicts (slot file names that already have a program).
export async function uploadNcProgramsBulk(body) {
  const res = await fetch(`${BASE_URL}api/nc-programs/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 409 && data?.conflicts?.length) {
    const err = new Error(`Already exist — ${data.conflicts.join(", ")}`);
    err.isConflict = true;
    err.conflicts = data.conflicts;
    throw err;
  }
  if (!res.ok) throw new Error(data?.error || data?.details || `Upload failed (HTTP ${res.status})`);
  return data;
}
