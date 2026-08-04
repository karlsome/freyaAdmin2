import { fetchMasterFactories } from "./api";

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

export async function fetchFactoryStatusFactories() {
  return fetchMasterFactories();
}

export async function fetchFactoryLiveMachines(factoryName) {
  return requestJson(`api/factory-status/machines/${encodeURIComponent(factoryName)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
}

export async function fetchFactoryStatusSnapshot({
  date,
  factories = [],
  advancedFilters = [],
  pagesByFactory = {},
  limit = 10,
  sort = {},
} = {}) {
  return requestJson("api/factory-status/snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date,
      factories,
      advancedFilters,
      pagesByFactory,
      limit,
      sort,
    }),
  });
}

export async function fetchFactoryStatusLogs({
  date,
  factories = [],
  equipment = "",
  workerName = "",
  status = "",
  sessionID = "",
  search = "",
  page = 1,
  limit = 25,
  sort = {},
} = {}) {
  return requestJson("api/factory-status/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date,
      factories,
      equipment,
      workerName,
      status,
      sessionID,
      search,
      page,
      limit,
      sort,
    }),
  });
}