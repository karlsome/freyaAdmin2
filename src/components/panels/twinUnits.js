import { KOSE_MACHINE_IDS } from "../../data/factoryLayouts/kose";
import { ATTENTION_STATUSES, STATUS_ORDER, effectiveStatus } from "../twin/twinTheme";

const naturalIds = [...KOSE_MACHINE_IDS].sort((a, b) => {
  const aNc = a.startsWith("OZNC");
  const bNc = b.startsWith("OZNC");
  if (aNc !== bNc) return aNc ? -1 : 1;
  return a.localeCompare(b, "en", { numeric: true });
});

export const shortId = (id) => (id || "").replace(/^OZ/, "");

/**
 * Machines on the floor map as display "units": pairs running together become one unit
 * with one status, one piece count and one worker.
 */
export function buildUnits(machinesById) {
  const seen = new Set();
  const units = [];
  naturalIds.forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const m = machinesById[id];
    const together = Boolean(m?.pair?.together && m.pair.partner);
    const partner = together ? machinesById[m.pair.partner] : null;
    if (together) seen.add(m.pair.partner);

    const status = effectiveStatus(m);
    const counting = together
      ? [m, partner].filter(Boolean).sort((a, b) => (b.todayCycles || 0) - (a.todayCycles || 0))[0]
      : m;
    units.push({
      id,
      ids: together ? [id, m.pair.partner] : [id],
      label: together ? `${shortId(id)} ⇄ ${shortId(m.pair.partner)}` : shortId(id),
      fullLabel: together ? `${id} ⇄ ${m.pair.partner}` : id,
      together,
      status,
      pieces: together ? m.pair.sharedPieces ?? null : m?.pieces ?? null,
      cycles: together ? m.pair.sharedCycles ?? 0 : m?.todayCycles ?? 0,
      worker: (together ? m.pair.worker : m?.worker) || partner?.worker || null,
      sebanggo: (together ? m.pair.sebanggo : m?.sebanggo) || partner?.sebanggo || null,
      secondsSinceCycle: counting?.secondsSinceCycle ?? null,
      alertSince: m?.alertSince || partner?.alertSince || null,
      hasCycleSensor: Boolean(m?.hasCycleSensor || partner?.hasCycleSensor),
    });
  });
  return units;
}

/** Units that need an admin, most urgent first. */
export function attentionUnits(units) {
  return units
    .filter((u) => ATTENTION_STATUSES.has(u.status))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
}

/** Minutes the unit has been in its current alert state (best effort). */
export function minutesInState(unit, now = Date.now()) {
  if (unit.alertSince) {
    const t = new Date(unit.alertSince).getTime();
    if (!Number.isNaN(t)) return Math.max(0, Math.round((now - t) / 60000));
  }
  if (unit.status === "idle" && unit.secondsSinceCycle !== null) return Math.round(unit.secondsSinceCycle / 60);
  return null;
}

export function formatMinutes(min, isJa) {
  if (min === null || min === undefined) return "";
  if (min < 60) return isJa ? `${min}分` : `${min} min`;
  const h = Math.floor(min / 60);
  return isJa ? `${h}時間${min % 60}分` : `${h}h ${min % 60}m`;
}
