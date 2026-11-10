// Inspection tables (Kensa interactive IT1 / IT2): turn the live machine_state entry + stop call into one status.
// `live` = liveMachines["IT1"] from the factory SSE stream (carries `kensa`, the bench snapshot the tablet posts).

export function kensaStatus(live, call) {
  if (call) return "stopCall";
  if (!live) return "off";
  if (live.mode === "maintenance") return "maintenance";
  if (live.mode === "break") return "break";
  if (live.mode === "running" || live.mode === "check") return "running";
  return "off"; // nobody is using the table
}

export function kensaTodayFor(kensaToday, machineId) {
  return kensaToday?.[machineId] || null;
}

/** Sum of the 12 NG counters across every scanned input: [{ n, label, count }] (zero counters left out). */
export function kensaNgBreakdown(kensa, isJa) {
  const sums = {};
  (kensa?.inputs || []).forEach((x) => {
    Object.entries(x.ng || {}).forEach(([k, v]) => {
      sums[k] = (sums[k] || 0) + (Number(v) || 0);
    });
  });
  return Array.from({ length: 12 }, (_, i) => i + 1)
    .map((n) => ({
      n,
      label: n === 12 ? (isJa ? "その他" : "Other") : `#${n}`,
      count: sums[`counter-${n}`] || 0,
    }))
    .filter((r) => r.count > 0);
}

export const KENSA_KIND_LABEL = {
  dcp: { ja: "プレス箱", en: "Press box" },
  srs: { ja: "SRS箱", en: "SRS box" },
  legacy: { ja: "従来QR", en: "Legacy QR" },
};
