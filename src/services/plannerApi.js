import { fetchMasterFactories, query } from "./api";

const LOCAL_URL = "http://localhost:3000/";
const ENV_URL = import.meta.env.VITE_API_URL?.trim();
const BASE_URL = (ENV_URL || LOCAL_URL).replace(/\/?$/, "/");

const PLANNER_PREVIEW_CACHE_MS = 60 * 1000;
const PLANNER_PUBLISHED_CACHE_MS = 60 * 1000;
const _previewCache = new Map();
const _publishedCache = new Map();
const _previewInflight = new Map();
const _publishedInflight = new Map();

function getPlannerCacheKey(factory = "", date = "") {
  return `${factory}__${date}`;
}

export function invalidatePlannerPreviewCache(factory, date) {
  if (factory && date) {
    const key = getPlannerCacheKey(factory, date);
    _previewCache.delete(key);
    _previewInflight.delete(key);
  } else {
    _previewCache.clear();
    _previewInflight.clear();
  }
}

export function invalidatePlannerPublishedCache(factory, date) {
  if (factory && date) {
    const key = getPlannerCacheKey(factory, date);
    _publishedCache.delete(key);
    _publishedInflight.delete(key);
  } else {
    _publishedCache.clear();
    _publishedInflight.clear();
  }
}

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

export async function upsertPlannerPlan({ factory, date, products, breaks, createdBy, startTime }) {
  const existingPlans = await fetchPlannerPlans({ factory, date });
  const payload = {
    factory,
    date,
    products,
    breaks,
    startTime,
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
        startTime,
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

// ─── Goal Reconciliation ───────────────────────────────────────────────────────
export async function reconcilePlannerGoals({ factory, date, goals = [], scheduledProducts = [] }) {
  if (!factory || !date) return { updatedCount: 0, updatedGoals: [] };

  const targetGoals = goals.filter((g) => g.date === date && g.factory === factory);
  let updatedCount = 0;
  const updatedGoals = [];

  for (const goal of targetGoals) {
    const actualScheduled = scheduledProducts
      .filter((p) => (p.goalId && p.goalId === goal._id) || (p.背番号 && p.背番号 === goal.背番号))
      .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);

    const target = Number(goal.targetQuantity) || 0;
    const currentScheduled = Number(goal.scheduledQuantity) || 0;

    if (actualScheduled !== currentScheduled) {
      const newRemaining = Math.max(0, target - actualScheduled);
      const newStatus = actualScheduled >= target ? "completed" : actualScheduled > 0 ? "in-progress" : "pending";

      await updatePlannerGoal(goal._id, {
        scheduledQuantity: actualScheduled,
        remainingQuantity: newRemaining,
        status: newStatus,
      });

      updatedCount++;
      updatedGoals.push({ ...goal, scheduledQuantity: actualScheduled, remainingQuantity: newRemaining, status: newStatus });
    }
  }

  return { updatedCount, updatedGoals };
}

// ─── Auto-Planner Preview & Draft ──────────────────────────────────────────────
export async function fetchPlannerPreview({ factory, date, forceRefresh = false } = {}) {
  if (!factory || !date) return null;

  const key = getPlannerCacheKey(factory, date);
  const now = Date.now();

  if (!forceRefresh) {
    const cached = _previewCache.get(key);
    if (cached && now - cached.ts < PLANNER_PREVIEW_CACHE_MS) {
      return cached.data;
    }

    const inflight = _previewInflight.get(key);
    if (inflight) return inflight;
  }

  const promise = (async () => {
    try {
      const params = new URLSearchParams({ factory, date });
      const result = await requestJson(`api/production-planner/preview?${params.toString()}`);
      const preview = result?.preview || result?.data || null;

      _previewCache.set(key, { ts: Date.now(), data: preview });
      return preview;
    } finally {
      _previewInflight.delete(key);
    }
  })();

  _previewInflight.set(key, promise);
  return promise;
}

export async function savePlannerPreviewDraft({ factory, date, scheduleUntilTime, updatedBy, assignments, basisRows }) {
  const result = await requestJson("api/production-planner/preview-draft/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      factory,
      date,
      scheduleUntilTime,
      updatedBy,
      assignments,
      basisRows,
    }),
  });

  invalidatePlannerPreviewCache(factory, date);
  return result?.data || result;
}

export async function deletePlannerPreviewDraft({ factory, date }) {
  const params = new URLSearchParams({ factory, date });
  const result = await requestJson(`api/production-planner/preview-draft?${params.toString()}`, {
    method: "DELETE",
  });

  invalidatePlannerPreviewCache(factory, date);
  return result;
}

// ─── Auto-Planner Published Schedules ──────────────────────────────────────────
export async function fetchPlannerPublished({ factory, date, forceRefresh = false } = {}) {
  if (!factory || !date) return null;

  const key = getPlannerCacheKey(factory, date);
  const now = Date.now();

  if (!forceRefresh) {
    const cached = _publishedCache.get(key);
    if (cached && now - cached.ts < PLANNER_PUBLISHED_CACHE_MS) {
      return cached.data;
    }

    const inflight = _publishedInflight.get(key);
    if (inflight) return inflight;
  }

  const promise = (async () => {
    try {
      const params = new URLSearchParams({ factory, date });
      const result = await requestJson(`api/production-planner/published?${params.toString()}`);
      const data = result?.data || null;

      _publishedCache.set(key, { ts: Date.now(), data });
      return data;
    } finally {
      _publishedInflight.delete(key);
    }
  })();

  _publishedInflight.set(key, promise);
  return promise;
}

export async function publishPlannerSchedule({
  factory,
  date,
  scheduleUntilTime,
  sourceMode = "auto",
  sourceType = "manual",
  sourceLabel = "",
  note = "",
  publishedBy,
  assignments,
  basisRows,
}) {
  const result = await requestJson("api/production-planner/published/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      factory,
      date,
      scheduleUntilTime,
      sourceMode,
      sourceType,
      sourceLabel,
      note,
      publishedBy,
      assignments,
      basisRows,
    }),
  });

  invalidatePlannerPreviewCache(factory, date);
  invalidatePlannerPublishedCache(factory, date);
  return result?.data || result;
}

export async function restorePlannerPublishedVersion({ factory, date, sourceVersion, publishedBy, note = "" }) {
  const result = await requestJson("api/production-planner/published/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      factory,
      date,
      sourceVersion,
      publishedBy,
      note,
    }),
  });

  invalidatePlannerPreviewCache(factory, date);
  invalidatePlannerPublishedCache(factory, date);
  return result?.data || result;
}