import { BASE_URL } from "./api";

const FACTORY_COLLECTIONS = ["pressDB", "slitDB", "SRSDB", "kensaDB"];

async function postJson(endpoint, body) {
  const response = await fetch(BASE_URL + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok || (data && data.success === false)) {
    throw new Error(data?.error || data?.message || `API ${response.status}`);
  }
  return data || {};
}

export async function fetchFinancials(params) {
  return postJson("api/financials", params);
}

export async function fetchFinancialsFactories() {
  const result = await postJson("api/factories/batch", { collections: FACTORY_COLLECTIONS });
  const set = new Set();
  Object.values(result?.results || {}).forEach((entry) => {
    (entry?.factories || []).forEach((factory) => {
      const name = String(factory ?? "").trim();
      if (name) set.add(name);
    });
  });
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

export async function fetchFinancialsBreakdown(params) {
  return postJson("api/financials/breakdown", params);
}

export async function fetchFinancialsBreakdownRecords(params) {
  return postJson("api/financials/breakdown/records", params);
}

export async function fetchFinancialsBreakdownRecord(source, id) {
  const result = await postJson("api/financials/breakdown/record", { source, id });
  return result.record;
}

export async function exportFinancialsCsv(params) {
  const response = await fetch(BASE_URL + "api/financials/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${response.status}`);
  }
  return response.blob();
}
