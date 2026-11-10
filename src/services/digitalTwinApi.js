import { BASE_URL } from "./api";

/**
 * Live digital-twin snapshot for one factory.
 * Backend: Kurachi GET /api/digital-twin/:factoryName
 */
export async function fetchDigitalTwin(factoryName) {
  const response = await fetch(`${BASE_URL}api/digital-twin/${encodeURIComponent(factoryName)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `API ${response.status}`);
  }
  return data;
}

/**
 * Factories the dashboard can show (recent press records or a cycle sensor).
 * Backend: Kurachi GET /api/digital-twin-factories
 */
export async function fetchTwinFactories() {
  const response = await fetch(`${BASE_URL}api/digital-twin-factories`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `API ${response.status}`);
  }
  return Array.isArray(data.factories) ? data.factories : [];
}

/**
 * Real (unsubmitted) pieces of every machine that is running right now:
 * cycle counter - today's submitted shots on that machine, x pcs per cycle.
 * Backend: Kurachi GET /api/planner/live-production -> { machines: [{ machine, 背番号, cycles, pcPerCycle, pieces, ng, source, counter }] }
 * Returns [] when the server cannot answer, so the caller degrades to submitted-only numbers.
 */
export async function fetchLiveProductionMachines(factoryName, date) {
  try {
    const params = new URLSearchParams({ factory: factoryName, date });
    const response = await fetch(`${BASE_URL}api/planner/live-production?${params.toString()}`);
    const data = await response.json().catch(() => ({}));
    return response.ok && Array.isArray(data?.data?.machines) ? data.data.machines : [];
  } catch {
    return [];
  }
}
