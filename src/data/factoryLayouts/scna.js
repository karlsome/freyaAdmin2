/**
 * SCNA factory floor map.
 * Coordinates are derived from the SCNA floor-plan diagram (720 × 880 px)
 * and converted to Three.js world units (1 unit = 34 px). X = right, Z = down (toward viewer).
 *
 * Left column (top → bottom):
 *   - ROLL STORAGE (zone)
 *   - SCNA-PSA (interactive PSA machine)
 *   - OFFICE (zone)
 *   - ENTRANCE/EXIT 1 (zone)
 *
 * Right column (top → bottom):
 *   - KUNTAI (press machine, copied from 小瀬)
 *   - AOL-1 (2500mm NC cutter — longer in length, always solo)
 *   - AOL-2 (1200mm NC cutter — solo or paired with AOL-3)
 *   - AOL-3 (1200mm NC cutter — solo or paired with AOL-2)
 *   - AOL-4 (1200mm NC cutter — solo or paired with AOL-5)
 *   - AOL-5 (1200mm NC cutter — solo or paired with AOL-4)
 *   - Girasol 1 & Girasol 2 (side-by-side interactive stamping machines)
 *   - ENTRANCE/EXIT 2 (zone)
 */

// Floor dimensions in Three.js world units (matches portrait aspect of the SCNA floor plan)
const FLOOR_WIDTH = 21.0;
const FLOOR_DEPTH = 25.0;

// Left edges of AOL-1..5 are aligned at x = 1.35.
// Standard 1200mm NC cutter has length 3.0 (center x = 2.85, spans 1.35 .. 4.35).
// Longer 2500mm AOL-1 has length 4.2 (center x = 3.45, spans 1.35 .. 5.55).
export const SCNA_LAYOUT = {
  factory: "SCNA",
  floor: { width: FLOOR_WIDTH, depth: FLOOR_DEPTH },
  // Default 3D camera orientation: view from +X looking toward -X (landscape view matching SCNA dashboard)
  cameraView: {
    dir: [0.57, 0.82, 0],
    focusDir: [0.62, 0.78, -0.3],
    target: [0.5, 0, 0],
    swapFloorAxes: true,
  },
  ncMachines: [
    { id: "AOL-1", pos: [3.45, -5.85] },
    { id: "AOL-2", pos: [2.85, -3.15] },
    { id: "AOL-3", pos: [2.85, -0.55] },
    { id: "AOL-4", pos: [2.85, 2.05] },
    { id: "AOL-5", pos: [2.85, 4.65] },
  ],
  manas: {
    id: "KUNTAI",
    aliases: ["KUNTAI", "SCNA-MANAS", "MANAS"],
    title: "KUNTAI",
    pos: [3.45, -9.55],
    size: [4.8, 3.6],
    modelScale: 0.78,
  },
  psaMachines: [
    {
      id: "SCNA-PSA",
      aliases: ["PSA"],
      title: "SCNA-PSA",
      pos: [-4.6, -5.0],
      size: [7.6, 2.7],
    },
  ],
  srsMachines: [
    {
      id: "Girasol 1",
      aliases: ["Girasol 1", "Girasol1", "Girasol-1", "SRS 1", "SRS1", "SRS-1"],
      title: "Girasol 1",
      pos: [2.55, 8.65],
      size: [3.3, 2.6],
    },
    {
      id: "Girasol 2",
      aliases: ["Girasol 2", "Girasol2", "Girasol-2", "SRS 2", "SRS2", "SRS-2"],
      title: "Girasol 2",
      pos: [6.35, 8.65],
      size: [3.3, 2.6],
    },
  ],
  zones: {
    rollStorage: {
      pos: [-4.6, -9.45],
      size: [7.6, 3.7],
      labelEn: "ROLL STORAGE",
      labelJa: "ROLL STORAGE (ロール保管)",
    },
    office: {
      pos: [-4.6, 3.45],
      size: [7.6, 11.8],
      labelEn: "OFFICE",
      labelJa: "OFFICE (事務所)",
    },
    entrances: [
      {
        id: "entrance_1",
        pos: [-4.4, 11.45],
        size: [3.8, 1.35],
        labelEn: "ENTRANCE / EXIT 1",
        labelJa: "ENTRANCE / EXIT 1 (出入口 1)",
      },
      {
        id: "entrance_2",
        pos: [4.6, 11.45],
        size: [3.8, 1.35],
        labelEn: "ENTRANCE / EXIT 2",
        labelJa: "ENTRANCE / EXIT 2 (出入口 2)",
      },
    ],
    kensaTables: [
      {
        id: "kensa_1",
        pos: [7.2, 3.35],
        size: [1.3, 3.2],
      },
      {
        id: "kensa_2",
        pos: [7.2, -1.85],
        size: [1.3, 3.2],
      },
    ],
  },
  // Fallback specs if setsubiDB has no data (from the floor plan labels)
  defaultSpecs: {
    "AOL-1": { noOfHead: 1, tableLength: 2500 },
    "AOL-2": { noOfHead: 1, tableLength: 1200 },
    "AOL-3": { noOfHead: 1, tableLength: 1200 },
    "AOL-4": { noOfHead: 1, tableLength: 1200 },
    "AOL-5": { noOfHead: 1, tableLength: 1200 },
  },
  // AOL-2/3 and AOL-4/5 can run solo or paired; AOL-1 is always solo
  pairs: [
    ["AOL-2", "AOL-3"],
    ["AOL-4", "AOL-5"],
  ],
  // Left empty until configured in SCNA
  sensors: [],
  cameras: [],
  callMonitor: {
    id: "scna_stopcall_tv",
    label: "Call Monitor TV",
    labelJa: "呼出モニター TV",
    pos: [0.0, -11.6],
    height: 3.4,
    rotationY: 0,
    url: "https://karlsome.github.io/Kurachi/factory-stopcall-tv.html?filter=SCNA",
  },
};

export const SCNA_DEFAULT_SENSORS = SCNA_LAYOUT.sensors;
export const SCNA_DEFAULT_CAMERAS = SCNA_LAYOUT.cameras;
export const SCNA_DEFAULT_MONITOR = SCNA_LAYOUT.callMonitor;

export const SCNA_MACHINE_IDS = [
  ...SCNA_LAYOUT.ncMachines.map((m) => m.id),
  SCNA_LAYOUT.manas.id,
  ...SCNA_LAYOUT.psaMachines.map((m) => m.id),
  ...SCNA_LAYOUT.srsMachines.map((m) => m.id),
];

// Alias map so backend records using "KUNTAI", "MANAS", "Girasol 1", "SRS1", etc. resolve to canonical SCNA IDs
export const SCNA_MACHINE_ALIASES = {
  KUNTAI: "KUNTAI",
  MANAS: "KUNTAI",
  "SCNA-MANAS": "KUNTAI",
  PSA: "SCNA-PSA",
  "SCNA-PSA": "SCNA-PSA",
  "GIRASOL 1": "Girasol 1",
  GIRASOL1: "Girasol 1",
  "GIRASOL-1": "Girasol 1",
  SRS1: "Girasol 1",
  "SRS-1": "Girasol 1",
  "SRS 1": "Girasol 1",
  "GIRASOL 2": "Girasol 2",
  GIRASOL2: "Girasol 2",
  "GIRASOL-2": "Girasol 2",
  SRS2: "Girasol 2",
  "SRS-2": "Girasol 2",
  "SRS 2": "Girasol 2",
};

export function resolveScnaMachineId(id) {
  if (!id) return id;
  const trimmed = String(id).trim();
  return SCNA_MACHINE_ALIASES[trimmed] || SCNA_MACHINE_ALIASES[trimmed.toUpperCase()] || trimmed;
}

/** Floor position [x, z] of a machine on the SCNA map, or null. */
export function getScnaMachinePosition(id) {
  const canonical = resolveScnaMachineId(id);
  if (canonical === SCNA_LAYOUT.manas.id) return SCNA_LAYOUT.manas.pos;
  const nc = SCNA_LAYOUT.ncMachines.find((m) => m.id === canonical);
  if (nc) return nc.pos;
  const psa = SCNA_LAYOUT.psaMachines.find((m) => m.id === canonical);
  if (psa) return psa.pos;
  const srs = SCNA_LAYOUT.srsMachines.find((m) => m.id === canonical);
  if (srs) return srs.pos;
  return null;
}

// Grid layout for Stop-Call Monitor TV modal when viewing SCNA
export const SCNA_TV_GRID = [
  "AOL-1", "SPACER", "GAP", "KUNTAI", "SCNA-PSA",
  "AOL-2", "AOL-3", "GAP", "Girasol 1", "Girasol 2",
  "AOL-4", "AOL-5", "GAP", "SPACER", "SPACER",
];

