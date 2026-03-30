// ─── Defect Rate ─────────────────────────────────────────────────────────────
export function getDefectStatus(rate) {
  if (rate >= 2.0) return {
    level: "high",
    label: "High Defect Rate",
    color: "text-error",
    bg: "bg-error/10 border border-error/20",
    dot: "bg-error",
    valueColor: "text-error",
  };
  if (rate >= 1.5) return {
    level: "warning",
    label: "Warning",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border border-amber-500/20",
    dot: "bg-amber-500",
    valueColor: "text-amber-600 dark:text-amber-400",
  };
  return {
    level: "normal",
    label: "Normal",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border border-emerald-500/20",
    dot: "bg-emerald-500",
    valueColor: "text-emerald-600 dark:text-emerald-400",
  };
}

// ─── Temperature ─────────────────────────────────────────────────────────────
export function getTempStatus(value) {
  if (value === null || value === undefined)
    return { level: "unknown", color: "text-outline", bg: "bg-surface-container" };
  if (value < 15 || value > 30)
    return { level: "danger", color: "text-error", bg: "bg-error/10" };
  if (value < 18 || value > 26)
    return { level: "warning", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" };
  return { level: "normal", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" };
}

// ─── Humidity ────────────────────────────────────────────────────────────────
export function getHumidityStatus(value) {
  if (value === null || value === undefined)
    return { level: "unknown", color: "text-outline", bg: "bg-surface-container" };
  if (value < 30 || value > 70)
    return { level: "danger", color: "text-error", bg: "bg-error/10" };
  if (value < 40 || value > 60)
    return { level: "warning", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" };
  return { level: "normal", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" };
}

// ─── CO₂ ─────────────────────────────────────────────────────────────────────
export function getCO2Status(value) {
  if (value === null || value === undefined)
    return { level: "unknown", color: "text-outline", bg: "bg-surface-container" };
  if (value >= 1500)
    return { level: "danger", color: "text-error", bg: "bg-error/10" };
  if (value >= 1000)
    return { level: "warning", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" };
  return { level: "normal", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" };
}

// ─── WBGT (Wet Bulb Globe Temperature) ───────────────────────────────────────
export function getWBGTStatus(value) {
  if (value === null || value === undefined)
    return { level: "unknown", color: "text-outline", bg: "bg-surface-container", label: "—" };
  if (value >= 31)
    return { level: "extreme", color: "text-error", bg: "bg-error/10", label: "Extreme" };
  if (value >= 28)
    return { level: "danger", color: "text-error", bg: "bg-error/10", label: "Danger" };
  if (value >= 25)
    return { level: "warning", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", label: "Warning" };
  if (value >= 21)
    return { level: "caution", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", label: "Caution" };
  return { level: "safe", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "Safe" };
}
