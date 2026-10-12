export const STATUS_ORDER = ["stopCall", "cncCancel", "maintenance", "break", "idle", "running", "off"];

export const STATUS_THEME = {
  running:     { color: "#22c55e", ja: "稼働中",   en: "Running",     icon: "play_circle",   pulse: false },
  idle:        { color: "#f59e0b", ja: "アイドル", en: "Idle",        icon: "hourglass_top", pulse: true },
  off:         { color: "#64748b", ja: "未稼働",   en: "Off",         icon: "power_settings_new", pulse: false },
  break:       { color: "#3b82f6", ja: "休憩中",   en: "Break",       icon: "coffee",        pulse: false },
  maintenance: { color: "#a855f7", ja: "メンテ中", en: "Maintenance", icon: "build",         pulse: true },
  stopCall:    { color: "#ef4444", ja: "呼出中",   en: "Stop call",   icon: "campaign",      pulse: true },
  cncCancel:   { color: "#ec4899", ja: "CNC中断",  en: "CNC cancel",  icon: "dangerous",     pulse: true },
};

/** Statuses that need an admin's attention. */
export const ATTENTION_STATUSES = new Set(["stopCall", "cncCancel", "maintenance", "idle"]);

export function statusLabel(status, isJa) {
  const theme = STATUS_THEME[status] || STATUS_THEME.off;
  return isJa ? theme.ja : theme.en;
}

/** Paired machines running together share one status. */
export function effectiveStatus(machine) {
  if (!machine) return "off";
  return machine.pair?.together && machine.pair?.status ? machine.pair.status : machine.status || "off";
}

export function formatAgo(seconds, isJa) {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return isJa ? `${seconds}秒前` : `${seconds}s ago`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return isJa ? `${min}分前` : `${min} min ago`;
  const h = Math.floor(min / 60);
  return isJa ? `${h}時間${min % 60}分前` : `${h}h ${min % 60}m ago`;
}

export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString();
}
