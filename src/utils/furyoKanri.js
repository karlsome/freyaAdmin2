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

// Per-process defect lists (ported from legacy freyaAdmin 不良管理).
// kensaDB is defined per モデル (counters 1–12); the others are fixed in the system.
export const FURYO_DEFAULT_PROCESS = "kensaDB";

export const FURYO_PROCESS_DEFECTS = {
  kensaDB: {
    labelJa: "検査",
    labelEn: "Inspection",
    icon: "search",
    descriptionJa: "モデルごとにカウンター1〜12の不良名を定義できます",
    descriptionEn: "Define defect names for counters 1–12 per model",
    counters: null,
  },
  pressDB: {
    labelJa: "プレス",
    labelEn: "Press",
    icon: "hardware",
    descriptionJa: "固定の不良項目（3項目）",
    descriptionEn: "Fixed defect items (3)",
    counters: [
      { jp: "疵引不良", en: "Scratch Defect" },
      { jp: "加工不良", en: "Processing Defect" },
      { jp: "その他", en: "Other" },
    ],
  },
  slitDB: {
    labelJa: "スリット",
    labelEn: "Slit",
    icon: "content_cut",
    descriptionJa: "固定の不良項目（3項目）",
    descriptionEn: "Fixed defect items (3)",
    counters: [
      { jp: "疵引不良", en: "Scratch Defect" },
      { jp: "加工不良", en: "Processing Defect" },
      { jp: "その他", en: "Other" },
    ],
  },
  SRSDB: {
    labelJa: "転写",
    labelEn: "Transfer",
    icon: "move_down",
    descriptionJa: "固定の不良項目（6項目）",
    descriptionEn: "Fixed defect items (6)",
    counters: [
      { jp: "くっつき・めくれ", en: "Sticking / Peeling" },
      { jp: "シワ", en: "Wrinkle" },
      { jp: "転写位置ズレ", en: "Transfer Position Shift" },
      { jp: "転写不良", en: "Transfer Defect" },
      { jp: "文字欠け", en: "Character Missing" },
      { jp: "その他", en: "Other" },
    ],
  },
};
