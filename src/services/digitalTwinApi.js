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
