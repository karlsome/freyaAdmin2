export const FURYO_EDIT_ROLES = ["admin", "部長", "課長", "係長"];
export const FURYO_COUNTER_COUNT = 12;
export const FURYO_COUNTER_KEYS = Array.from({ length: FURYO_COUNTER_COUNT }, (_, index) => `counter-${index + 1}`);

export function getEmptyCounterMap() {
  return Object.fromEntries(FURYO_COUNTER_KEYS.map((key) => [key, ""]));
}

export function normalizeCounterMap(counterMap = {}) {
  const normalized = getEmptyCounterMap();
  FURYO_COUNTER_KEYS.forEach((key) => {
    normalized[key] = String(counterMap?.[key] || "").trim();
  });
  return normalized;
}

export function normalizeDefectDefinitions(definitions = []) {
  const byModel = {};

  definitions.forEach((definition) => {
    const model = String(definition?.モデル || "").trim();
    if (!model) return;

    byModel[model] = {
      model,
      counters: normalizeCounterMap(definition?.counters),
      countersEn: normalizeCounterMap(definition?.counters_en),
      updatedAt: definition?.updatedAt || null,
      updatedBy: definition?.updatedBy || "",
    };
  });

  return byModel;
}

export function countDefinedCounters(counterMap = {}) {
  return FURYO_COUNTER_KEYS.reduce((count, key) => count + (String(counterMap?.[key] || "").trim() ? 1 : 0), 0);
}

export function hasCounterChanges(leftMap = {}, rightMap = {}) {
  return FURYO_COUNTER_KEYS.some((key) => String(leftMap?.[key] || "").trim() !== String(rightMap?.[key] || "").trim());
}

export function canEditFuryoDefinitions(role = "") {
  return FURYO_EDIT_ROLES.includes(String(role || ""));
}

export function getFuryoModelBadge(counterMap = {}) {
  const definedCount = countDefinedCounters(counterMap);
  return {
    definedCount,
    complete: definedCount === FURYO_COUNTER_COUNT,
  };
}

export function sortFuryoModels(models = []) {
  return [...models]
    .filter(Boolean)
    .map((model) => String(model))
    .sort((left, right) => left.localeCompare(right, "ja"));
}

export function filterFuryoModels(models = [], searchValue = "") {
  const normalized = String(searchValue || "").trim().toLowerCase();
  if (!normalized) return sortFuryoModels(models);

  return sortFuryoModels(models).filter((model) => model.toLowerCase().includes(normalized));
}