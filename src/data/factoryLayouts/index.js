import { KOSE_LAYOUT, KOSE_MACHINE_IDS } from "./kose";

/**
 * Factories with a hand-made 3D floor map. Every other factory gets the automatic 2D floor plan
 * built from the machines it actually used (tablet-based status until sensors exist).
 */
const LAYOUTS = {
  [KOSE_LAYOUT.factory]: { has3D: true, machineIds: KOSE_MACHINE_IDS },
};

export const DEFAULT_FACTORY = KOSE_LAYOUT.factory;

export function getFactoryLayout(factory) {
  return LAYOUTS[factory] || null;
}

export function has3DLayout(factory) {
  return Boolean(LAYOUTS[factory]?.has3D);
}

/**
 * Machine ids to show for a factory: the fixed map if there is one, otherwise the machines
 * used recently (falling back to everything the backend knows if none were used).
 */
export function machineIdsFor(factory, machines = []) {
  const layout = LAYOUTS[factory];
  if (layout) return layout.machineIds;
  const used = machines.filter((m) => m.recentlyUsed).map((m) => m.id);
  const ids = used.length ? used : machines.map((m) => m.id);
  return [...ids].sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));
}
