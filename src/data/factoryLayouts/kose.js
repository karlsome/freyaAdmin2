/**
 * 小瀬 factory floor map.
 * Coordinates are taken from the floor-plan screenshot (px, canvas ≈ 1010 × 575)
 * and converted to Three.js world units (1 unit = 40 px). X = right, Z = down (toward viewer).
 */
const SCALE = 40;
const CENTER_X = 505;
const CENTER_Z = 287;
const toWorld = (x, z) => [(x - CENTER_X) / SCALE, (z - CENTER_Z) / SCALE];

const COL_A = 140;
const COL_B = 325;
const COL_C = 653;
const COL_D = 828;
const LEFT_ROWS = [70, 150, 230, 310, 390, 465];
const RIGHT_ROWS = [190, 270, 350, 425];

const column = (x, rows, ids) => ids.map((id, i) => ({ id, pos: toWorld(x, rows[i]) }));

export const KOSE_LAYOUT = {
  factory: "小瀬",
  floor: { width: 1010 / SCALE, depth: 575 / SCALE },
  ncMachines: [
    ...column(COL_A, LEFT_ROWS, ["OZNC01", "OZNC03", "OZNC05", "OZNC07", "OZNC09", "OZNC18"]),
    ...column(COL_B, LEFT_ROWS, ["OZNC02", "OZNC04", "OZNC06", "OZNC08", "OZNC10", "OZNC17"]),
    ...column(COL_C, RIGHT_ROWS, ["OZNC11", "OZNC13", "OZNC15", "OZNC16"]),
    ...column(COL_D, RIGHT_ROWS, ["OZNC12", "OZNC14"]),
  ],
  manas: { id: "OZMANAS", pos: toWorld(858, 442), size: [203 / SCALE, 215 / SCALE] },
  room: { pos: toWorld(780, 71), size: [405 / SCALE, 118 / SCALE] },
  pallet: { pos: toWorld(521, 536), size: [277 / SCALE, 77 / SCALE] },
  // Fallback specs if setsubiDB has no data (from the floor plan labels)
  defaultSpecs: {
    OZNC03: { noOfHead: 1, tableLength: 2000 },
    OZNC05: { noOfHead: 1, tableLength: 2000 },
    OZNC07: { noOfHead: 1, tableLength: 2000 },
    OZNC09: { noOfHead: 1, tableLength: 2000 },
    OZNC04: { noOfHead: 2, tableLength: 1200 },
    OZNC06: { noOfHead: 2, tableLength: 1200 },
    OZNC08: { noOfHead: 2, tableLength: 1200 },
    OZNC10: { noOfHead: 2, tableLength: 1200 },
  },
  // Fixed pairs (also derived from setsubiDB by the backend)
  pairs: [
    ["OZNC03", "OZNC05"],
    ["OZNC04", "OZNC06"],
    ["OZNC07", "OZNC09"],
    ["OZNC08", "OZNC10"],
  ],
  sensors: [
    {
      id: "84:1F:E8:17:39:A0",
      deviceId: "84:1F:E8:17:39:A0",
      name: "Sensor 1 - OZNC11",
      nameJa: "Sensor 1 - OZNC11",
      pos: toWorld(610, 185),
      radius: 3.0,
      defaultTemp: 21.3,
      defaultHumidity: 40.7,
    },
    {
      id: "68:FE:71:32:40:04",
      deviceId: "68:FE:71:32:40:04",
      name: "Sensor 2 - 入口",
      nameJa: "Sensor 2 - 入口",
      pos: toWorld(505, 490),
      radius: 3.0,
      defaultTemp: 19.4,
      defaultHumidity: 39.6,
    },
    {
      id: "68:FE:71:32:3E:90",
      deviceId: "68:FE:71:32:3E:90",
      name: "Sensor 3 - OZNC18",
      nameJa: "Sensor 3 - OZNC18",
      pos: toWorld(185, 465),
      radius: 3.0,
      defaultTemp: 18.8,
      defaultHumidity: 33.1,
    },
    {
      id: "68:FE:71:A5:5F:EC",
      deviceId: "68:FE:71:A5:5F:EC",
      name: "Sensor 4 - OZNC03",
      nameJa: "Sensor 4 - OZNC03",
      pos: toWorld(185, 150),
      radius: 3.0,
      defaultTemp: 20.1,
      defaultHumidity: 34.8,
    },
  ],
  cameras: [
    {
      id: "tapo_cam",
      streamId: "tapo_cam",
      label: "CAM 1 (SRS Line)",
      labelJa: "CAM 1（SRSライン）",
      pos: toWorld(60, 80),
      rotationY: Math.PI / 4,
    },
    {
      id: "tapo_cam2",
      streamId: "tapo_cam2",
      label: "CAM 2 (Press / Center)",
      labelJa: "CAM 2（プレス・中央通路）",
      pos: toWorld(505, 50),
      rotationY: Math.PI,
    },
    {
      id: "tapo_cam3",
      streamId: "tapo_cam3",
      label: "CAM 3 (Inspection & Manas)",
      labelJa: "CAM 3（検査・MANAS）",
      pos: toWorld(960, 320),
      rotationY: -Math.PI * 0.75,
    },
  ],
  callMonitor: {
    id: "kose_stopcall_tv",
    label: "Call Monitor TV",
    labelJa: "呼出モニター TV",
    pos: toWorld(232, 10),
    height: 3.4,
    rotationY: 0,
    url: "https://karlsome.github.io/Kurachi/factory-stopcall-tv.html?filter=%E5%B0%8F%E7%80%AC",
  },
};

export const KOSE_DEFAULT_SENSORS = KOSE_LAYOUT.sensors;
export const KOSE_DEFAULT_CAMERAS = KOSE_LAYOUT.cameras;
export const KOSE_DEFAULT_MONITOR = KOSE_LAYOUT.callMonitor;

export const KOSE_MACHINE_IDS = [
  ...KOSE_LAYOUT.ncMachines.map((m) => m.id),
  KOSE_LAYOUT.manas.id,
];

/** Table length (x) in world units for a given mm table size. */
export function ncLengthFor(tableLength) {
  const len = Number(tableLength) || 0;
  if (len >= 2400) return 4.2;
  if (len >= 2000) return 3.4;
  return 3.0;
}
export const NC_DEPTH = 1.3;

/** Floor position [x, z] of a machine on the 小瀬 map, or null. */
export function getMachinePosition(id) {
  if (id === KOSE_LAYOUT.manas.id) return KOSE_LAYOUT.manas.pos;
  return KOSE_LAYOUT.ncMachines.find((m) => m.id === id)?.pos || null;
}
