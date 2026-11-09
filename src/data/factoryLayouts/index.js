import { KOSE_LAYOUT, KOSE_MACHINE_IDS, getMachinePosition as getKoseMachinePosition } from "./kose";
import { SCNA_LAYOUT, SCNA_MACHINE_IDS, getScnaMachinePosition, resolveScnaMachineId } from "./scna";

/**
 * Factories with a hand-made 3D floor map. Every other factory gets the automatic 2D floor plan
 * built from the machines it actually used (tablet-based status until sensors exist).
 */
const LAYOUTS = {
  [KOSE_LAYOUT.factory]: {
    has3D: true,
    machineIds: KOSE_MACHINE_IDS,
    layout: KOSE_LAYOUT,
    getMachinePosition: getKoseMachinePosition,
  },
  [SCNA_LAYOUT.factory]: {
    has3D: true,
    machineIds: SCNA_MACHINE_IDS,
    layout: SCNA_LAYOUT,
    getMachinePosition: getScnaMachinePosition,
  },
};

export const DEFAULT_FACTORY = KOSE_LAYOUT.factory;

export const DEFAULT_3D_FACTORIES = [
  { factory: KOSE_LAYOUT.factory, hasCycleSensors: true, has3D: true },
  { factory: SCNA_LAYOUT.factory, hasCycleSensors: true, has3D: true },
];

export function getFactoryLayout(factory) {
  return LAYOUTS[factory] || null;
}

export function getFactory3DLayout(factory) {
  return LAYOUTS[factory]?.layout || KOSE_LAYOUT;
}

export function has3DLayout(factory) {
  return Boolean(LAYOUTS[factory]?.has3D);
}

export function getMachinePositionForFactory(id, factory = DEFAULT_FACTORY) {
  const entry = LAYOUTS[factory];
  if (entry?.getMachinePosition) {
    return entry.getMachinePosition(id);
  }
  return getKoseMachinePosition(id) || getScnaMachinePosition(id);
}

export function normalizeFactoryMachineId(id, factory) {
  if (factory === SCNA_LAYOUT.factory) {
    return resolveScnaMachineId(id);
  }
  return id;
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
