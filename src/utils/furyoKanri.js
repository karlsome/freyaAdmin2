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

// 不良管理 sections. "master" is the defect catalog; the others are processes whose base list
// (and per-model differences) is picked from that catalog. Lists are served by the Kurachi server.
export const FURYO_DEFAULT_PROCESS = "kensaDB";
export const FURYO_MASTER_KEY = "master";
export const DEFECT_OTHER_ID = "other";

export const FURYO_SECTIONS = {
  master: {
    labelJa: "不良マスタ",
    labelEn: "Defect Master",
    icon: "library_books",
    descriptionJa: "全製品共通の不良項目一覧。各工程のリストはここから選択します。",
    descriptionEn: "All defects across products. Each process picks its list from here.",
  },
  kensaDB: { labelJa: "検査", labelEn: "Inspection", icon: "search" },
  pressDB: { labelJa: "プレス", labelEn: "Press", icon: "hardware" },
  slitDB: { labelJa: "スリット", labelEn: "Slit", icon: "content_cut" },
  SRSDB: { labelJa: "SRS", labelEn: "SRS", icon: "move_down" },
};

export const FURYO_PROCESS_KEYS = ["kensaDB", "pressDB", "slitDB", "SRSDB"];

export function isFuryoProcess(key) {
  return FURYO_PROCESS_KEYS.includes(key);
}

// Base ids with その他 forced last (mirrors the server)
export function withOtherLast(ids = []) {
  return [...ids.filter((id) => id !== DEFECT_OTHER_ID), DEFECT_OTHER_ID];
}

// base − hidden + extras, その他 last; deleted catalog items skipped (mirrors /resolvedDefectList)
export function resolveDefectIds(baseIds = [], override = null, catalogById = new Map()) {
  const hidden = new Set(override?.hidden || []);
  const ids = [];
  baseIds.forEach((id) => {
    if (!hidden.has(id) && id !== DEFECT_OTHER_ID && !ids.includes(id)) ids.push(id);
  });
  (override?.extras || []).forEach((id) => {
    if (id !== DEFECT_OTHER_ID && !ids.includes(id)) ids.push(id);
  });
  ids.push(DEFECT_OTHER_ID);
  return ids.filter((id) => {
    const item = catalogById.get(id);
    return item && (id === DEFECT_OTHER_ID || !item.deleted);
  });
}
