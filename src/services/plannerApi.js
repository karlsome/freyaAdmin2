import { fetchMasterFactories, query } from "./api";

const LOCAL_URL = "http://localhost:3000/";
const ENV_URL = import.meta.env.VITE_API_URL?.trim();
const BASE_URL = (ENV_URL || LOCAL_URL).replace(/\/?$/, "/");

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson(endpoint, options = {}) {
  const res = await fetch(BASE_URL + endpoint, options);
  const data = await readJson(res);

  if (!res.ok) {
    const message = typeof data === "string"
      ? data
      : data?.error || data?.message || `API ${res.status}`;
    throw new Error(message);
  }

  return data;
}

export async function fetchPlannerFactories() {
  return fetchMasterFactories();
}

export async function fetchPlannerEquipment(factory) {
  if (!factory) return [];

  const rows = await query(
    "submittedDB",
    "pressDB",
    { 工場: factory },
    { projection: { 設備: 1 }, limit: 10000 },
  );

  const equipment = [...new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => row?.設備)
      .filter((value) => value && String(value).trim())
  )];

  return equipment.sort((left, right) => String(left).localeCompare(String(right), "ja"));
}

export async function fetchPlannerProducts() {
  const rows = await query(
    "Sasaki_Coating_MasterDB",
    "masterDB",
    {},
    {
      projection: {
        背番号: 1,
        品番: 1,
        品名: 1,
        収容数: 1,
        モデル: 1,
        pcPerCycle: 1,
        "秒数(1pcs何秒)": 1,
      },
      limit: 20000,
    },
  );

  return Array.isArray(rows) ? rows : [];
}

export async function fetchPlannerGoals({ factory, date, endDate } = {}) {
  const params = new URLSearchParams();
  if (factory) params.set("factory", factory);

  if (date && endDate) {
    params.set("startDate", date);
    params.set("endDate", endDate);
  } else if (date) {
    params.set("date", date);
  }

  const result = await requestJson(`api/production-goals?${params.toString()}`);
  return Array.isArray(result?.data) ? result.data : [];
}

export async function createPlannerGoal(payload) {
  return requestJson("api/production-goals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function batchCreatePlannerGoals(goals, createdBy) {
  return requestJson("api/production-goals/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goals, createdBy }),
  });
}

export async function updatePlannerGoal(goalId, updates) {
  return requestJson(`api/production-goals/${encodeURIComponent(goalId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function schedulePlannerGoal(goalId, quantityToSchedule) {
  return requestJson(`api/production-goals/${encodeURIComponent(goalId)}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantityToSchedule }),
  });
}

export async function deletePlannerGoal(goalId) {
  return requestJson(`api/production-goals/${encodeURIComponent(goalId)}`, {
    method: "DELETE",
  });
}

export async function checkPlannerGoalDuplicates(factory, items) {
  return requestJson("api/production-goals/check-duplicates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ factory, items }),
  });
}

export async function lookupPlannerProduct({ searchType, searchValue, factory }) {
  return requestJson("api/production-goals/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ searchType, searchValue, factory }),
  });
}

export async function fetchPlannerPressHistory(factory, items) {
  return requestJson("api/production-goals/press-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ factory, items }),
  });
}

export async function fetchPlannerPlans({ factory, date } = {}) {
  const params = new URLSearchParams();
  if (factory) params.set("factory", factory);
  if (date) params.set("date", date);

  try {
    const result = await requestJson(`api/production-plans?${params.toString()}`);
    return Array.isArray(result?.data) ? result.data : [];
  } catch {
    const rows = await query(
      "submittedDB",
      "productionPlansDB",
      { ...(factory ? { factory } : {}), ...(date ? { date } : {}) },
      { limit: 20 },
    );
    return Array.isArray(rows) ? rows : [];
  }
}

export async function upsertPlannerPlan({ factory, date, products, breaks, createdBy }) {
  const existingPlans = await fetchPlannerPlans({ factory, date });
  const payload = {
    factory,
    date,
    products,
    breaks,
    createdBy,
    updatedBy: createdBy,
  };

  if (existingPlans.length > 0) {
    return requestJson("api/production-plans/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: existingPlans[0]._id,
        factory,
        date,
        products,
        breaks,
        updatedBy: createdBy,
      }),
    });
  }

  return requestJson("api/production-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deletePlannerPlan(planId) {
  return requestJson(`api/production-plans/${encodeURIComponent(planId)}`, {
    method: "DELETE",
  });
}

export async function deletePlannerPlanByFactoryDate(factory, date) {
  const existingPlans = await fetchPlannerPlans({ factory, date });
  if (!existingPlans.length) return { success: true, deletedCount: 0 };

  return deletePlannerPlan(existingPlans[0]._id);
}

export async function fetchPlannerActualProduction(factory, date) {
  if (!factory || !date) return [];

  const rows = await query(
    "submittedDB",
    "pressDB",
    { 工場: factory, Date: date },
    { sort: { Time_start: 1 }, limit: 10000 },
  );

  return Array.isArray(rows) ? rows : [];
}

export async function fetchPlannerInProgress(factory, date) {
  if (!factory || !date) return [];

  const rows = await query(
    "submittedDB",
    "tabletLogDB",
    { 工場: factory, Date: date },
    { limit: 20000 },
  );

  return Array.isArray(rows) ? rows : [];
}