/**
 * Widgets that can be placed in a dashboard slot.
 * `legacy: true` widgets need today's production records (useTodayData).
 * Every widget appears at most once per layout; picking one that's already used swaps the two slots.
 */
export const WIDGETS = {
  twin:       { icon: "view_in_ar",              color: "#3b82f6", en: "3D Factory",          ja: "3D工場" },
  machines:   { icon: "grid_view",               color: "#22c55e", en: "Machine board",       ja: "設備ボード" },
  alerts:     { icon: "notifications_active",    color: "#ef4444", en: "Needs attention",     ja: "要対応" },
  goal:       { icon: "flag",                    color: "#a855f7", en: "Goal & output",       ja: "目標と生産数" },
  workers:    { icon: "groups",                  color: "#06b6d4", en: "Workers on floor",    ja: "現場の作業者" },
  camera:     { icon: "videocam",                color: "#f97316", en: "Camera",              ja: "カメラ" },
  production: { icon: "precision_manufacturing", color: "#2563eb", en: "All-factory output",  ja: "全工場の生産", legacy: true },
  defects:    { icon: "report",                  color: "#e11d48", en: "Quality & defects",   ja: "品質・不良", legacy: true },
  issues:     { icon: "assignment_late",         color: "#d97706", en: "Issues & approvals",  ja: "課題・承認", legacy: true },
  finance:    { icon: "payments",                color: "#16a34a", en: "Finance",             ja: "財務", legacy: true },
  telemetry:  { icon: "sensors",                 color: "#0891b2", en: "Machine telemetry",   ja: "設備テレメトリ", legacy: true },
};

/** Order shown in the picker: simple live widgets first, then the older detailed cards. */
export const PICKER_GROUPS = [
  { en: "Live factory", ja: "ライブ工場", ids: ["twin", "machines", "alerts", "goal", "workers", "camera"] },
  { en: "Detailed cards", ja: "詳細カード", ids: ["production", "defects", "issues", "finance", "telemetry"] },
];

/** Grid slots per layout mode (matches the 4 sketches). */
export const LAYOUT_MODES = {
  1: { areas: ["a"] },
  2: { areas: ["a", "b"] },
  3: { areas: ["a", "b", "c"] },
  4: { areas: ["a", "b", "c", "d"] },
};

/** Slots whose right edge is the right edge of the grid (the machine drawer opens over them). */
export const RIGHT_EDGE_SLOTS = {
  1: [0],
  2: [0, 1],
  3: [1, 2],
  4: [1, 3],
};

export const DEFAULT_SLOTS = {
  1: ["twin"],
  2: ["twin", "goal"],
  3: ["alerts", "goal", "twin"],
  4: ["twin", "alerts", "goal", "machines"],
};

/** Old AI card ids → widget ids (the AI copilot still answers with the old card names). */
export const AI_CARD_TO_WIDGET = {
  production: "production",
  finance: "finance",
  defects: "defects",
  camera: "camera",
  telemetry: "telemetry",
  issues: "issues",
};

export function widgetLabel(id, isJa) {
  const w = WIDGETS[id];
  if (!w) return id;
  return isJa ? w.ja : w.en;
}
