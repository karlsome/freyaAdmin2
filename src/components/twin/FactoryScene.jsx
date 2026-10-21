import { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Edges, Grid } from "@react-three/drei";
import { Html } from "./HtmlOverlay";
import NcCutter from "./NcCutter";
import ManasMachine from "./ManasMachine";
import { PsaMachine, SrsMachine, KensaTable } from "./ScnaMachines";
import SensorMarker from "./SensorMarker";
import CameraMarker from "./CameraMarker";
import MachineCallEffect from "./MachineCallEffect";
import StopCallMonitor3D from "./StopCallMonitor3D";
import { KOSE_LAYOUT, NC_DEPTH, ncLengthFor } from "../../data/factoryLayouts/kose";
import { getFactory3DLayout, getMachinePositionForFactory, machineIdsFor } from "../../data/factoryLayouts";
import { STATUS_THEME, effectiveStatus, formatNumber } from "./twinTheme";
import { CALL_THEMES } from "../../hooks/useFactoryCallMonitor";

// Suppress @react-three/fiber's internal `new THREE.Clock()` deprecation warning on Three.js r183+
if (typeof THREE.setConsoleFunction === "function") {
  THREE.setConsoleFunction((level, message, ...params) => {
    if (level === "warn" && typeof message === "string" && message.includes("THREE.Clock:")) {
      return;
    }
    const fn = console[level] || console.log;
    fn.call(console, message, ...params);
  });
}

const DEFAULT_TARGET = [0, 0, 0.25];
const VIEW_DIR = (() => {
  const v = [0, 0.82, 0.57];
  const len = Math.hypot(...v);
  return v.map((n) => n / len);
})();
const FOCUS_DIR = (() => {
  const v = [0.3, 0.78, 0.62];
  const len = Math.hypot(...v);
  return v.map((n) => n / len);
})();

function normalizeVec3(v, fallback) {
  if (!Array.isArray(v) || v.length < 3) return fallback;
  const len = Math.hypot(v[0], v[1], v[2]);
  return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : fallback;
}

function sceneColors(isDark) {
  return isDark
    ? { bg: "#0b1220", floor: "#141c2b", cell: "#1e293b", section: "#2b3a52", wall: "#334155", label: "dark" }
    : { bg: "#eef2f7", floor: "#e4e9f0", cell: "#d3dbe6", section: "#bcc8d8", wall: "#94a3b8", label: "light" };
}

/* ── Camera rig: default overview + fly-to on selection ── */
function CameraRig({
  floor = KOSE_LAYOUT.floor,
  cameraView = null,
  selectedPos,
  drawerOpen,
  viewKey,
  controlsEnabled = true,
}) {
  const controlsRef = useRef();
  const { size } = useThree();

  const viewDir = useMemo(() => normalizeVec3(cameraView?.dir, VIEW_DIR), [cameraView?.dir]);
  const focusDir = useMemo(() => normalizeVec3(cameraView?.focusDir, FOCUS_DIR), [cameraView?.focusDir]);
  const defaultTarget = cameraView?.target || DEFAULT_TARGET;
  const swapAxes = Boolean(cameraView?.swapFloorAxes);

  const overview = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const k = 2 * Math.tan((40 * Math.PI) / 360);
    const fWidth = floor?.width || KOSE_LAYOUT.floor.width;
    const fDepth = floor?.depth || KOSE_LAYOUT.floor.depth;
    const depthSpan = Math.max(18.8, (swapAxes ? fWidth : fDepth) + 3.6);
    const widthSpan = (swapAxes ? fDepth : fWidth) + 3.6;
    const dist = Math.max(depthSpan / k, widthSpan / (k * aspect)) * 1.08;
    return {
      pos: defaultTarget.map((t, i) => t + viewDir[i] * dist),
      target: defaultTarget,
    };
  }, [size.width, size.height, floor?.width, floor?.depth, swapAxes, defaultTarget, viewDir]);

  const didInitRef = useRef(false);
  const prevCameraViewRef = useRef(cameraView);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const isFactorySwitch = !didInitRef.current || prevCameraViewRef.current !== cameraView;
    didInitRef.current = true;
    prevCameraViewRef.current = cameraView;
    const animate = !isFactorySwitch;

    if (selectedPos) {
      const target = [selectedPos[0], 0.5, selectedPos[1]];
      const pos = target.map((t, i) => t + focusDir[i] * 9);
      c.setLookAt(...pos, ...target, animate);
      c.setFocalOffset(drawerOpen ? 1.8 : 0, 0, 0, animate);
    } else {
      c.setFocalOffset(0, 0, 0, animate);
      c.setLookAt(...overview.pos, ...overview.target, animate);
    }
  }, [selectedPos, drawerOpen, overview, focusDir, cameraView, viewKey]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={controlsEnabled}
      minDistance={4}
      maxDistance={90}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2.35}
      smoothTime={0.45}
      dollySpeed={0.6}
    />
  );
}

/* ── Floor, walls and grid ── */
const Floor = memo(function Floor({ floor = KOSE_LAYOUT.floor, colors, onPointerDown, onPointerMove, onPointerUp }) {
  const { width, depth } = floor;
  const wall = 0.08;
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={colors.floor} roughness={0.95} />
      </mesh>
      <Grid
        position={[0, 0.004, 0]}
        args={[width, depth]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor={colors.cell}
        sectionSize={2}
        sectionThickness={1}
        sectionColor={colors.section}
        fadeDistance={90}
        fadeStrength={0}
      />
      {[
        [0, -depth / 2, width + wall, wall],
        [0, depth / 2, width + wall, wall],
        [-width / 2, 0, wall, depth],
        [width / 2, 0, wall, depth],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.15, z]}>
          <boxGeometry args={[w, 0.3, d]} />
          <meshStandardMaterial color={colors.wall} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
});

function SceneLabel({ position, icon, text, tone = "neutral" }) {
  return (
    <Html position={position} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
      <div className={`twin-zone-label twin-zone-label--${tone}`}>
        <span className="material-symbols-outlined">{icon}</span>
        <span>{text}</span>
      </div>
    </Html>
  );
}

// Shared static geometries & materials for decorative zones
const CHAIR_GEO = new THREE.BoxGeometry(0.35, 0.44, 0.35);
const CHAIR_MAT = new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.7 });
const TABLE_GEO = new THREE.BoxGeometry(3.2, 0.06, 1.0);
const TABLE_MAT = new THREE.MeshStandardMaterial({ color: "#d6b88d", roughness: 0.7 });

const PALLET_SLAT_GEO = new THREE.BoxGeometry(1.25, 0.1, 0.16);
const PALLET_SLAT_MAT = new THREE.MeshStandardMaterial({ color: "#a47148", roughness: 0.9 });
const PALLET_TOP_GEO = new THREE.BoxGeometry(1.25, 0.04, 1.0);
const PALLET_TOP_MAT = new THREE.MeshStandardMaterial({ color: "#b98555", roughness: 0.9 });
const PALLET_BOX_GEO = new THREE.BoxGeometry(0.48, 0.36, 0.4);
const PALLET_BOX_MAT_A = new THREE.MeshStandardMaterial({ color: "#d4b08a", roughness: 0.85 });
const PALLET_BOX_MAT_B = new THREE.MeshStandardMaterial({ color: "#c8a27a", roughness: 0.85 });

const STANDING_ROLL_GEO = new THREE.CylinderGeometry(0.24, 0.24, 1, 16);
const STANDING_CORE_GEO = new THREE.CylinderGeometry(0.095, 0.095, 1, 12);
const STANDING_HOLE_GEO = new THREE.CylinderGeometry(0.055, 0.055, 1, 10);
const STORAGE_ROLL_MAT_A = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.6 });
const STORAGE_ROLL_MAT_B = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.6 });
const STORAGE_ROLL_MAT_C = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.55 });
const STORAGE_CORE_MAT = new THREE.MeshStandardMaterial({ color: "#b45309", roughness: 0.8 });
const STORAGE_HOLE_MAT = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.9 });
const ROLL_PALLET_SLAT_GEO = new THREE.BoxGeometry(1.5, 0.1, 0.16);
const ROLL_PALLET_TOP_GEO = new THREE.BoxGeometry(1.5, 0.045, 1.3);

const DOOR_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const DOOR_FRAME_MAT = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.45, metalness: 0.35 });
const DOOR_ACCENT_MAT = new THREE.MeshStandardMaterial({ color: "#ec4899", roughness: 0.4, metalness: 0.15 });
const DOOR_LEAF_MAT = new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.4, metalness: 0.2 });
const DOOR_GLASS_MAT = new THREE.MeshStandardMaterial({ color: "#38bdf8", roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.55 });
const DOOR_BAR_MAT = new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.3, metalness: 0.65 });
const DOOR_EXIT_SIGN_MAT = new THREE.MeshStandardMaterial({ color: "#10b981", emissive: "#10b981", emissiveIntensity: 0.75, toneMapped: false });
const DOOR_MAT_FLOOR = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.9 });

const OFFICE_MONITOR_GEO = new THREE.BoxGeometry(0.46, 0.28, 0.04);
const OFFICE_MONITOR_MAT = new THREE.MeshStandardMaterial({ color: "#0f172a", emissive: "#38bdf8", emissiveIntensity: 0.25 });

/* ── Meeting / break room (小瀬) ── */
const MeetingRoom = memo(function MeetingRoom({ room = KOSE_LAYOUT.room, isJa }) {
  const { pos, size } = room;
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[size[0], 1.5, size[1]]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.12} depthWrite={false} />
        <Edges color="#f59e0b" />
      </mesh>
      {/* simple table + chairs */}
      <mesh position={[0, 0.38, 0]} geometry={TABLE_GEO} material={TABLE_MAT} />
      {[-1.2, -0.4, 0.4, 1.2].flatMap((x) => [-0.8, 0.8].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.22, z]} geometry={CHAIR_GEO} material={CHAIR_MAT} />
      )))}
      <SceneLabel position={[0, 1.9, 0]} icon="meeting_room" text={isJa ? "小瀬ガレージ / 会議室" : "Meeting / Break room"} tone="amber" />
    </group>
  );
});

/* ── Finished-goods pallet zone (小瀬) ── */
const PalletZone = memo(function PalletZone({ pallet = KOSE_LAYOUT.pallet, isJa }) {
  const { pos, size } = pallet;
  const pallets = [-2.3, 0, 2.3];
  const stacks = [
    [[0, 0], [0.5, 0], [0, 0.42], [0.5, 0.42], [0.25, 0.21, 1]],
    [[0, 0], [0.5, 0], [0, 0.42], [0.25, 0.21, 1], [0.25, 0.21, 2]],
    [[0, 0], [0.5, 0], [0.25, 0.42]],
  ];
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <meshBasicMaterial color="#2dd4bf" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {pallets.map((x, pi) => (
        <group key={x} position={[x, 0, 0]}>
          {[-0.4, 0, 0.4].map((z) => (
            <mesh key={z} position={[0, 0.05, z]} geometry={PALLET_SLAT_GEO} material={PALLET_SLAT_MAT} />
          ))}
          <mesh position={[0, 0.12, 0]} geometry={PALLET_TOP_GEO} material={PALLET_TOP_MAT} />
          {stacks[pi].map(([bx, bz, level = 0], bi) => (
            <mesh
              key={bi}
              position={[bx - 0.25, 0.32 + level * 0.36, bz - 0.21]}
              geometry={PALLET_BOX_GEO}
              material={bi % 2 ? PALLET_BOX_MAT_B : PALLET_BOX_MAT_A}
            />
          ))}
        </group>
      ))}
      <SceneLabel position={[0, 1.6, 0]} icon="inventory_2" text={isJa ? "出荷パレット" : "Finished-goods pallet"} tone="teal" />
    </group>
  );
});

/* ── SCNA Roll Storage Zone: Wooden pallets with vertical standing material rolls ── */
const ROLL_STORAGE_PALLETS = [
  { px: -2.2, pz: -0.82, heights: [0.92, 0.84, 0.96, 0.78] },
  { px: -2.2, pz: 0.82, heights: [0.86, 0.94, 0.8, 0.9] },
  { px: 0.0, pz: -0.82, heights: [0.95, 0.88, 0.82, 0.92] },
  { px: 0.0, pz: 0.82, heights: [0.8, 0.9, 0.96, 0.85] },
  { px: 2.2, pz: -0.82, heights: [0.88, 0.76, 0.92, 0.84] },
  { px: 2.2, pz: 0.82, heights: [0.94, 0.86, 0.9, 0.78] },
];
const STANDING_ROLL_OFFSETS = [
  [-0.36, -0.32],
  [0.36, -0.32],
  [-0.36, 0.32],
  [0.36, 0.32],
];
const ROLL_MATS = [STORAGE_ROLL_MAT_A, STORAGE_ROLL_MAT_B, STORAGE_ROLL_MAT_C];

const RollStorageZone = memo(function RollStorageZone({ zone, isJa }) {
  if (!zone) return null;
  const { pos } = zone;

  return (
    <group position={[pos[0], 0, pos[1]]}>
      {ROLL_STORAGE_PALLETS.map(({ px, pz, heights }, pIdx) => (
        <group key={`${px}-${pz}`} position={[px, 0, pz]}>
          {/* Wooden pallet stringers & top deck */}
          {[-0.48, 0, 0.48].map((sz) => (
            <mesh key={sz} position={[0, 0.05, sz]} geometry={ROLL_PALLET_SLAT_GEO} material={PALLET_SLAT_MAT} receiveShadow />
          ))}
          <mesh position={[0, 0.122, 0]} geometry={ROLL_PALLET_TOP_GEO} material={PALLET_TOP_MAT} castShadow receiveShadow />

          {/* 4 vertical (standing) cylindrical rolls per pallet */}
          {STANDING_ROLL_OFFSETS.map(([rx, rz], rIdx) => {
            const h = heights[rIdx] || 0.88;
            const mat = ROLL_MATS[(pIdx + rIdx) % ROLL_MATS.length];
            return (
              <group key={`${rx}-${rz}`} position={[rx, 0.145, rz]}>
                <mesh position={[0, h / 2, 0]} scale={[1, h, 1]} geometry={STANDING_ROLL_GEO} material={mat} castShadow receiveShadow />
                <mesh position={[0, h / 2 + 0.006, 0]} scale={[1, h + 0.012, 1]} geometry={STANDING_CORE_GEO} material={STORAGE_CORE_MAT} />
                <mesh position={[0, h / 2 + 0.01, 0]} scale={[1, h + 0.02, 1]} geometry={STANDING_HOLE_GEO} material={STORAGE_HOLE_MAT} />
              </group>
            );
          })}
        </group>
      ))}

      <SceneLabel
        position={[0, 1.55, 0]}
        icon="album"
        text={isJa ? zone.labelJa || "ROLL STORAGE" : zone.labelEn || "ROLL STORAGE"}
        tone="blue"
      />
    </group>
  );
});

/* ── SCNA 5-Room Office Complex (President/CEO Office, Leader Office, Office, Laboratory, Cafeteria) ── */
const OFFICE_BASE_MAT = new THREE.MeshBasicMaterial({ color: "#0284c7", transparent: true, opacity: 0.14, depthWrite: false });
const ROOM_PAD_MAT = new THREE.MeshBasicMaterial({ color: "#334155", transparent: true, opacity: 0.22, depthWrite: false });
const ROOM_WALL_MAT = new THREE.MeshStandardMaterial({ color: "#94a3b8", transparent: true, opacity: 0.12, depthWrite: false });
const EXEC_DESK_MAT = new THREE.MeshStandardMaterial({ color: "#92400e", roughness: 0.55 });
const CAFE_TABLE_MAT = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.45 });
const CAFE_COUNTER_MAT = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.55 });
const COFFEE_BODY_MAT = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.35, metalness: 0.4 });
const COFFEE_CHROME_MAT = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.25, metalness: 0.75 });
const COFFEE_CUP_MAT = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 });
const LAB_CHAMBER_MAT = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.35, metalness: 0.3 });
const LAB_BENCH_TOP_MAT = new THREE.MeshStandardMaterial({ color: "#0f766e", roughness: 0.5 });
const LAB_SAMPLE_AMBER = new THREE.MeshStandardMaterial({ color: "#f59e0b", roughness: 0.25, transparent: true, opacity: 0.85 });
const LAB_SAMPLE_BLUE = new THREE.MeshStandardMaterial({ color: "#38bdf8", roughness: 0.25, transparent: true, opacity: 0.85 });

function SingleComputerDesk({ position, executive = false }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} scale={[0.85, 0.055, 1.55]} geometry={DOOR_UNIT_BOX} material={executive ? EXEC_DESK_MAT : TABLE_MAT} castShadow receiveShadow />
      <mesh position={[0, 0.21, -0.68]} scale={[0.78, 0.42, 0.07]} geometry={DOOR_UNIT_BOX} material={CHAIR_MAT} />
      <mesh position={[0, 0.21, 0.68]} scale={[0.78, 0.42, 0.07]} geometry={DOOR_UNIT_BOX} material={CHAIR_MAT} />
      {/* Monitor + stand + keyboard */}
      <mesh position={[-0.14, 0.6, 0]} rotation={[0, Math.PI / 2, 0]} geometry={OFFICE_MONITOR_GEO} material={OFFICE_MONITOR_MAT} />
      <mesh position={[-0.16, 0.46, 0]} scale={[0.06, 0.08, 0.14]} geometry={DOOR_UNIT_BOX} material={CHAIR_MAT} />
      <mesh position={[0.12, 0.455, 0]} scale={[0.14, 0.015, 0.36]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} />
      {/* Operator chair */}
      <mesh position={[0.52, 0.22, 0]} geometry={CHAIR_GEO} material={DOOR_FRAME_MAT} />
      <mesh position={[0.67, 0.42, 0]} scale={[0.06, 0.38, 0.34]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} />
      {/* Visitor chairs for President/CEO Office */}
      {executive &&
        [-0.38, 0.38].map((vz) => (
          <mesh key={vz} position={[-0.58, 0.22, vz]} geometry={CHAIR_GEO} material={CHAIR_MAT} />
        ))}
    </group>
  );
}

function RoomBox({ center, size, borderColor = "#64748b" }) {
  const [sx, sz] = size;
  return (
    <group position={[center[0], 0, center[1]]}>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[sx, sz]} />
        <primitive object={ROOM_PAD_MAT} attach="material" />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[sx, 0.76, sz]} />
        <primitive object={ROOM_WALL_MAT} attach="material" />
        <Edges color={borderColor} />
      </mesh>
    </group>
  );
}

const OfficeZone = memo(function OfficeZone({ zone, isJa }) {
  if (!zone) return null;
  const { pos, size } = zone;

  // 4 desks in the main "Office" room (top-middle)
  const officeDesks = [
    [-2.5, 1.85],
    [-2.5, -0.15],
    [-1.25, 1.85],
    [-1.25, -0.15],
  ];

  // 3 lunch tables in the "Cafeteria" room (shifted right so coffee station sits on the left)
  const cafeTableZs = [0.2, -2.0, -4.2];

  // 3 refrigerator-style adhesive test chambers in the "Laboratory" room (top-right)
  const labChamberZs = [-2.35, -3.55, -4.75];

  return (
    <group position={[pos[0], 0, pos[1]]}>
      {/* Outer blue zone floor tint matching the SCNA floor plan diagram */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <primitive object={OFFICE_BASE_MAT} attach="material" />
      </mesh>

      {/* ── 1. President / CEO Office (Upper-Left, single computer table) ── */}
      <RoomBox center={[-1.15, 4.55]} size={[2.6, 2.15]} borderColor="#f59e0b" />
      <SingleComputerDesk position={[-1.15, 0, 4.55]} executive />
      <SceneLabel
        position={[-1.15, 1.45, 4.55]}
        icon="badge"
        text={isJa ? "President/CEO Office (社長室)" : "President/CEO Office"}
        tone="amber"
      />

      {/* ── 2. Leader Office (Lower-Left, single computer table) ── */}
      <RoomBox center={[1.95, 4.55]} size={[2.8, 2.15]} borderColor="#38bdf8" />
      <SingleComputerDesk position={[1.95, 0, 4.55]} />
      <SceneLabel
        position={[1.95, 1.45, 4.55]}
        icon="supervisor_account"
        text={isJa ? "Leader Office (リーダー室)" : "Leader Office"}
        tone="blue"
      />

      {/* ── 3. Main Office (Top-Middle, 4 computers and tables) ── */}
      <RoomBox center={[-1.9, 0.85]} size={[3.15, 4.1]} borderColor="#f59e0b" />
      {officeDesks.map(([dx, dz]) => (
        <SingleComputerDesk key={`${dx}-${dz}`} position={[dx, 0, dz]} />
      ))}
      <SceneLabel
        position={[-1.9, 1.55, 0.85]}
        icon="apartment"
        text={isJa ? "Office (事務所)" : "Office"}
        tone="amber"
      />

      {/* ── 4. Laboratory (Top-Right, adhesive experiment room with refrigerator-style test chambers) ── */}
      <RoomBox center={[-1.9, -3.55]} size={[3.15, 4.1]} borderColor="#2dd4bf" />
      {/* 3 Tall Refrigerator-style Adhesive Environmental / Curing Chambers along back wall (-X) */}
      {labChamberZs.map((cz, idx) => (
        <group key={`chamber-${cz}`} position={[-3.02, 0, cz]}>
          {/* Tall rectangular refrigerator/chamber body */}
          <mesh position={[0, 0.68, 0]} scale={[0.72, 1.36, 0.86]} geometry={DOOR_UNIT_BOX} material={LAB_CHAMBER_MAT} castShadow receiveShadow />
          {/* Upper digital controller header + glowing status display */}
          <mesh position={[0.365, 1.24, 0]} scale={[0.02, 0.14, 0.78]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} />
          <mesh position={[0.378, 1.24, -0.16]} scale={[0.01, 0.07, 0.22]} geometry={DOOR_UNIT_BOX} material={idx === 1 ? DOOR_EXIT_SIGN_MAT : OFFICE_MONITOR_MAT} />
          {/* Glass inspection door window on front (+X) face */}
          <mesh position={[0.365, 0.76, 0]} scale={[0.02, 0.58, 0.56]} geometry={DOOR_UNIT_BOX} material={DOOR_GLASS_MAT} />
          {/* Lower chamber service panel */}
          <mesh position={[0.365, 0.22, 0]} scale={[0.02, 0.32, 0.76]} geometry={DOOR_UNIT_BOX} material={DOOR_BAR_MAT} />
          {/* Vertical refrigerator door handle */}
          <mesh position={[0.39, 0.76, 0.34]} scale={[0.025, 0.36, 0.025]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} />
        </group>
      ))}
      {/* Side double-door chemical / adhesive storage refrigerator */}
      <group position={[-1.65, 0, -5.18]}>
        <mesh position={[0, 0.68, 0]} scale={[1.18, 1.36, 0.66]} geometry={DOOR_UNIT_BOX} material={LAB_CHAMBER_MAT} castShadow receiveShadow />
        {[-0.28, 0.28].map((hx) => (
          <mesh key={hx} position={[hx, 0.72, 0.335]} scale={[0.48, 1.18, 0.02]} geometry={DOOR_UNIT_BOX} material={DOOR_LEAF_MAT} />
        ))}
        <mesh position={[-0.05, 0.72, 0.355]} scale={[0.02, 0.34, 0.02]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} />
        <mesh position={[0.05, 0.72, 0.355]} scale={[0.02, 0.34, 0.02]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} />
      </group>
      {/* Central adhesive experiment lab workbench with sample bottles & testing gear */}
      <group position={[-1.35, 0, -3.25]}>
        <mesh position={[0, 0.36, 0]} scale={[0.88, 0.72, 2.2]} geometry={DOOR_UNIT_BOX} material={DOOR_LEAF_MAT} castShadow receiveShadow />
        <mesh position={[0, 0.74, 0]} scale={[0.94, 0.045, 2.26]} geometry={DOOR_UNIT_BOX} material={LAB_BENCH_TOP_MAT} receiveShadow />
        {/* Adhesive sample jars / beakers */}
        {[-0.65, -0.35, -0.05].map((bz, bi) => (
          <mesh
            key={bz}
            position={[-0.12, 0.84, bz]}
            scale={[0.32, 0.16, 0.32]}
            geometry={STANDING_ROLL_GEO}
            material={bi % 2 === 0 ? LAB_SAMPLE_BLUE : LAB_SAMPLE_AMBER}
          />
        ))}
        {/* Digital viscometer / tensile tester + lab monitor */}
        <mesh position={[0.05, 0.92, 0.55]} scale={[0.32, 0.34, 0.32]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} />
        <mesh position={[-0.15, 0.9, -0.82]} rotation={[0, Math.PI / 2, 0]} geometry={OFFICE_MONITOR_GEO} material={OFFICE_MONITOR_MAT} />
      </group>
      <SceneLabel
        position={[-1.9, 1.55, -3.55]}
        icon="science"
        text={isJa ? "Laboratory (接着剤実験室)" : "Laboratory"}
        tone="teal"
      />

      {/* ── 5. Cafeteria (Bottom-Right, break/lunch tables, chairs, and coffee machine station) ── */}
      <RoomBox center={[1.85, -1.325]} size={[3.25, 8.55]} borderColor="#10b981" />
      {/* 3 Cafeteria dining tables with 4 chairs each */}
      {cafeTableZs.map((tz) => (
        <group key={`cafe-tbl-${tz}`} position={[1.85, 0, tz]}>
          <mesh position={[0, 0.42, 0]} scale={[1.65, 0.055, 0.95]} geometry={DOOR_UNIT_BOX} material={CAFE_TABLE_MAT} castShadow receiveShadow />
          {[-0.68, 0.68].flatMap((lx) =>
            [-0.36, 0.36].map((lz) => (
              <mesh key={`${lx}-${lz}`} position={[lx, 0.21, lz]} scale={[0.06, 0.42, 0.06]} geometry={DOOR_UNIT_BOX} material={CHAIR_MAT} />
            ))
          )}
          {[-0.45, 0.45].flatMap((cx) =>
            [-0.72, 0.72].map((cz) => (
              <mesh key={`cchair-${cx}-${cz}`} position={[cx, 0.22, cz]} geometry={CHAIR_GEO} material={CHAIR_MAT} />
            ))
          )}
        </group>
      ))}
      {/* Cafeteria Coffee Bar Counter + 3D Espresso/Coffee Machine + Breakroom Fridge (Left / +Z side) */}
      <group position={[1.55, 0, 2.38]}>
        {/* Kitchenette counter cabinet */}
        <mesh position={[0, 0.38, 0]} scale={[2.1, 0.76, 0.72]} geometry={DOOR_UNIT_BOX} material={CAFE_COUNTER_MAT} castShadow receiveShadow />
        <mesh position={[0, 0.78, 0]} scale={[2.16, 0.045, 0.76]} geometry={DOOR_UNIT_BOX} material={CAFE_TABLE_MAT} receiveShadow />
        {/* 3D Coffee / Espresso Machine (facing -Z into cafeteria) */}
        <group position={[-0.42, 0.8, 0]}>
          {/* Main coffee machine housing */}
          <mesh position={[0, 0.24, 0.05]} scale={[0.46, 0.48, 0.42]} geometry={DOOR_UNIT_BOX} material={COFFEE_BODY_MAT} castShadow />
          {/* Top overhanging brew head + metallic dispense spout */}
          <mesh position={[0, 0.38, -0.14]} scale={[0.44, 0.14, 0.18]} geometry={DOOR_UNIT_BOX} material={COFFEE_CHROME_MAT} />
          <mesh position={[0, 0.27, -0.15]} scale={[0.14, 0.1, 0.1]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} />
          {/* Top coffee bean hopper */}
          <mesh position={[-0.1, 0.54, 0.04]} scale={[0.45, 0.14, 0.45]} geometry={STANDING_ROLL_GEO} material={DOOR_FRAME_MAT} />
          {/* Illuminated display on front of coffee machine */}
          <mesh position={[0.12, 0.38, -0.235]} scale={[0.12, 0.07, 0.01]} geometry={DOOR_UNIT_BOX} material={DOOR_EXIT_SIGN_MAT} />
          {/* Drip tray + 2 white coffee cups */}
          <mesh position={[0, 0.02, -0.14]} scale={[0.42, 0.03, 0.18]} geometry={DOOR_UNIT_BOX} material={COFFEE_CHROME_MAT} />
          {[-0.09, 0.09].map((cupX) => (
            <mesh key={cupX} position={[cupX, 0.075, -0.14]} scale={[0.2, 0.08, 0.2]} geometry={STANDING_ROLL_GEO} material={COFFEE_CUP_MAT} />
          ))}
        </group>
        {/* Microwave / toaster oven next to coffee machine */}
        <mesh position={[0.48, 0.94, 0.04]} scale={[0.52, 0.28, 0.38]} geometry={DOOR_UNIT_BOX} material={COFFEE_BODY_MAT} castShadow />
        <mesh position={[0.42, 0.94, -0.155]} scale={[0.32, 0.18, 0.01]} geometry={DOOR_UNIT_BOX} material={OFFICE_MONITOR_MAT} />
      </group>
      {/* Breakroom Refrigerator next to Coffee Counter (Left / +Z side) */}
      <group position={[3.02, 0, 2.38]}>
        <mesh position={[0, 0.68, 0]} scale={[0.68, 1.36, 0.72]} geometry={DOOR_UNIT_BOX} material={LAB_CHAMBER_MAT} castShadow receiveShadow />
        <mesh position={[-0.22, 0.76, -0.365]} scale={[0.025, 0.36, 0.025]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} />
      </group>

      <SceneLabel
        position={[1.85, 1.45, -1.325]}
        icon="coffee"
        text={isJa ? "Cafeteria (カフェテリア・休憩室)" : "Cafeteria"}
        tone="teal"
      />
    </group>
  );
});

/* ── SCNA Entrance / Exit Zones: 3D double-door portal along the perimeter wall ── */
const EntranceZone = memo(function EntranceZone({ entrance, isJa }) {
  if (!entrance) return null;
  const { pos } = entrance;
  const doorZ = 0.82;

  return (
    <group position={[pos[0], 0, pos[1]]}>
      {/* Threshold floor mat + pink safety border inside doorway */}
      <mesh position={[0, 0.012, 0.22]} scale={[2.6, 0.016, 1.15]} geometry={DOOR_UNIT_BOX} material={DOOR_ACCENT_MAT} receiveShadow />
      <mesh position={[0, 0.022, 0.22]} scale={[2.46, 0.014, 1.02]} geometry={DOOR_UNIT_BOX} material={DOOR_MAT_FLOOR} receiveShadow />

      {/* 3D Door Frame / Portal Jambs & Header along +Z wall */}
      {[-1.26, 1.26].map((jx) => (
        <group key={`jamb-${jx}`} position={[jx, 0.9, doorZ]}>
          <mesh scale={[0.14, 1.8, 0.18]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} castShadow />
          <mesh position={[0, 0, -0.095]} scale={[0.15, 1.82, 0.02]} geometry={DOOR_UNIT_BOX} material={DOOR_ACCENT_MAT} />
        </group>
      ))}
      {/* Top header lintel beam */}
      <mesh position={[0, 1.84, doorZ]} scale={[2.72, 0.14, 0.2]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} castShadow />
      <mesh position={[0, 1.84, doorZ - 0.105]} scale={[2.74, 0.06, 0.02]} geometry={DOOR_UNIT_BOX} material={DOOR_ACCENT_MAT} />

      {/* Overhead illuminated green EXIT sign box */}
      <mesh position={[0, 2.02, doorZ - 0.02]} scale={[0.56, 0.18, 0.08]} geometry={DOOR_UNIT_BOX} material={DOOR_FRAME_MAT} />
      <mesh position={[0, 2.02, doorZ - 0.065]} scale={[0.48, 0.12, 0.015]} geometry={DOOR_UNIT_BOX} material={DOOR_EXIT_SIGN_MAT} />

      {/* Double swing door leaves (hinged at jambs, swung open inward ~38°) */}
      {[-1, 1].map((side) => (
        <group
          key={`leaf-${side}`}
          position={[side * 1.18, 0, doorZ - 0.02]}
          rotation={[0, side * 0.66, 0]}
        >
          <group position={[-side * 0.56, 0.86, 0]}>
            {/* Door leaf panel */}
            <mesh scale={[1.12, 1.68, 0.06]} geometry={DOOR_UNIT_BOX} material={DOOR_LEAF_MAT} castShadow receiveShadow />
            {/* Door perimeter accent frame */}
            <mesh position={[0, 0.82, 0]} scale={[1.13, 0.04, 0.065]} geometry={DOOR_UNIT_BOX} material={DOOR_ACCENT_MAT} />
            <mesh position={[0, -0.82, 0]} scale={[1.13, 0.04, 0.065]} geometry={DOOR_UNIT_BOX} material={DOOR_ACCENT_MAT} />
            {/* Upper glass vision window */}
            <mesh position={[0, 0.32, 0]} scale={[0.62, 0.52, 0.07]} geometry={DOOR_UNIT_BOX} material={DOOR_GLASS_MAT} />
            {/* Horizontal crash/push bar on both sides of door */}
            <mesh position={[0, -0.06, -0.045]} scale={[0.86, 0.045, 0.035]} geometry={DOOR_UNIT_BOX} material={DOOR_BAR_MAT} />
            <mesh position={[0, -0.06, 0.045]} scale={[0.86, 0.045, 0.035]} geometry={DOOR_UNIT_BOX} material={DOOR_BAR_MAT} />
          </group>
        </group>
      ))}

      <SceneLabel
        position={[0, 2.35, 0.45]}
        icon="door_front"
        text={isJa ? entrance.labelJa || entrance.labelEn : entrance.labelEn}
        tone="pink"
      />
    </group>
  );
});

/* ── Pair connection on the floor between paired machines ── */
const PairLink = memo(function PairLink({ a, b, together, color }) {
  const ref = useRef();
  if (!a || !b) return null;
  const x = (a[0] + b[0]) / 2;
  const z1 = Math.min(a[1], b[1]) + NC_DEPTH / 2 + 0.05;
  const z2 = Math.max(a[1], b[1]) - NC_DEPTH / 2 - 0.05;
  const len = Math.max(0.05, z2 - z1);

  useFrame(({ clock }) => {
    if (!together || !ref.current) return;
    const opacity = 0.65 + Math.sin(clock.getElapsedTime() * 3) * 0.25;
    ref.current.children.forEach((child) => { child.material.opacity = opacity; });
  });

  return (
    <group ref={ref} position={[x, 0.02, (z1 + z2) / 2]}>
      {[-0.35, 0.35].map((dx) => (
        <mesh key={dx} position={[dx, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, len]} />
          <meshBasicMaterial
            color={together ? color : "#94a3b8"}
            transparent
            opacity={together ? 0.8 : 0.25}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
});

/* ── Floating compact micro-badge above a machine ── */
const MachineBadge = memo(function MachineBadge({
  machineId,
  position,
  height,
  title,
  value,
  unit,
  status,
  isJa,
  dim,
  onSelect,
  selected,
  sebanggo,
  call,
  totalNG = 0,
}) {
  const theme = STATUS_THEME[status] || STATUS_THEME.off;
  const callTheme = call?.theme || null;
  const badgeColor = callTheme ? callTheme.color : theme.color;
  const shortTitle = String(title).replace(/^OZ/, "");
  const showStatusTag = !call && (status === "break" || status === "maintenance" || status === "cncCancel" || status === "stopCall");

  return (
    <Html position={[position[0], height, position[1]]} center zIndexRange={[30, 10]}>
      <button
        type="button"
        onClick={() => onSelect && onSelect(machineId)}
        className={`twin-badge ${selected ? "twin-badge--selected" : ""} ${dim && !call ? "twin-badge--dim" : ""} ${(theme.pulse || call) ? "twin-badge--alert" : ""} ${call ? `twin-badge--calling twin-badge--calling-${call.primaryCall}` : ""}`}
        style={{ "--status": badgeColor }}
      >
        {/* Row 1: Dot + Short Machine Name + Inline Sebanggo + Rank/NG */}
        <span className="twin-badge__title">
          <span className="twin-badge__dot" />
          <span>{shortTitle}</span>
          {sebanggo && status !== "off" && (
            <span className="twin-badge__sebanggo" title={`背番号: ${sebanggo}`}>
              {sebanggo}
            </span>
          )}
          {call && <span className="twin-badge__rank">#{call.rank}</span>}
          {totalNG > 0 && <span className="twin-badge__ng">NG {totalNG}</span>}
        </span>

        {/* Row 2: Active Call Pills OR Compact Piece Count */}
        {call ? (
          <div className="twin-badge__calls">
            {call.leader && (
              <span className="twin-badge__call-pill" style={{ background: CALL_THEMES.leader.color }}>
                🚨{isJa ? "呼出" : "CALL"}
              </span>
            )}
            {call.stop && (
              <span className="twin-badge__call-pill" style={{ background: CALL_THEMES.stop.color }}>
                🛑{isJa ? "停止" : "STOP"}
              </span>
            )}
            {call.box && (
              <span className="twin-badge__call-pill" style={{ background: CALL_THEMES.box.color }}>
                📦{isJa ? "空箱" : "BOX"}
              </span>
            )}
            {call.material && (
              <span className="twin-badge__call-pill" style={{ background: CALL_THEMES.material.color }}>
                🧻{call.zairyoSebanggo || (isJa ? "部材" : "ROLL")}
              </span>
            )}
            <span className="twin-badge__call-timer">{call.waitFormatted}</span>
          </div>
        ) : (
          <div className="twin-badge__bottom">
            <span className="twin-badge__value">
              {value}
              {unit && <small>{unit}</small>}
            </span>
            {showStatusTag && (
              <span className="twin-badge__status">{isJa ? theme.ja : theme.en}</span>
            )}
          </div>
        )}
      </button>
    </Html>
  );
});

function badgeValue(machine, isJa, shared = false) {
  const pieces = shared ? machine?.pair?.sharedPieces : machine?.pieces;
  const cycles = shared ? machine?.pair?.sharedCycles : machine?.todayCycles;
  if (pieces !== null && pieces !== undefined && pieces > 0) return { value: formatNumber(pieces), unit: isJa ? "個" : "pcs" };
  if (cycles) return { value: formatNumber(cycles), unit: isJa ? "回" : "cyc" };
  return { value: "0", unit: isJa ? "個" : "pcs" };
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();

/**
 * Projects window pointer coordinates directly onto the mathematical floor plane (y = 0)
 * during active drag so HTML overlays and 3D machine meshes never block dragging.
 */
function FloorDragTracker({ floor = KOSE_LAYOUT.floor, activeDrag, onUpdatePosition, onEndDrag }) {
  const { camera, gl } = useThree();

  useEffect(() => {
    if (!activeDrag) return undefined;

    const hw = (floor?.width || KOSE_LAYOUT.floor.width) / 2 - 0.5;
    const hd = (floor?.depth || KOSE_LAYOUT.floor.depth) / 2 - 0.5;

    const handlePointerMove = (e) => {
      if (!onUpdatePosition || !gl?.domElement) return;
      const rect = gl.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      camera.updateMatrixWorld();
      _raycaster.setFromCamera(_ndc, camera);
      const hit = _raycaster.ray.intersectPlane(FLOOR_PLANE, _hit);
      if (!hit) return;

      const x = Math.max(-hw, Math.min(hw, hit.x));
      const z = Math.max(-hd, Math.min(hd, hit.z));
      const roundedX = Math.round(x * 20) / 20;
      const roundedZ = Math.round(z * 20) / 20;
      onUpdatePosition(activeDrag.type, activeDrag.id, [roundedX, roundedZ]);
    };

    const handlePointerUp = () => {
      if (onEndDrag) onEndDrag();
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [activeDrag, camera, gl, onUpdatePosition, onEndDrag, floor?.width, floor?.depth]);

  return null;
}

/* ── Scene contents ── */
function FactoryContents({
  layout = KOSE_LAYOUT,
  layoutMachineIds = [],
  machinesById,
  selectedId,
  onSelect,
  isJa,
  colors,
  sensors = [],
  cameras = [],
  callMonitor = null,
  activeCalls = [],
  callsByMachine = {},
  liveMachines = {},
  isCallStreamConnected = false,
  onSelectCamera,
  onOpenCallMonitor,
  showSensors = true,
  showCameras = true,
  showCallMonitor = true,
  showSensorInfo = false,
  editMode = false,
  activeDrag = null,
  onStartDrag,
  onUpdateMonitorHeight,
  onCommitPositions,
  onRotateCamera,
}) {
  const ncPos = useMemo(
    () => Object.fromEntries((layout.ncMachines || []).map((m) => [m.id, m.pos])),
    [layout]
  );

  const pairState = useMemo(
    () =>
      (layout.pairs || []).map(([a, b]) => {
        const ma = machinesById[a];
        const mb = machinesById[b];
        const together = Boolean(ma?.pair?.together || mb?.pair?.together);
        const lead = ma?.pair?.together ? ma : mb;
        return { a, b, together, lead, status: together ? effectiveStatus(lead) : null };
      }),
    [layout.pairs, machinesById]
  );

  const pairedTogether = new Set(pairState.filter((p) => p.together).flatMap((p) => [p.a, p.b]));

  const psaMachines = layout.psaMachines || [];
  const srsMachines = layout.srsMachines || [];

  return (
    <>
      <Floor floor={layout.floor} colors={colors} />

      {/* 小瀬 decorative zones */}
      {layout.room && <MeetingRoom room={layout.room} isJa={isJa} />}
      {layout.pallet && <PalletZone pallet={layout.pallet} isJa={isJa} />}

      {/* SCNA decorative zones (ROLL STORAGE, OFFICE, ENTRANCE/EXIT 1 & 2, KENSA TABLES) */}
      {layout.zones?.rollStorage && <RollStorageZone zone={layout.zones.rollStorage} isJa={isJa} />}
      {layout.zones?.office && <OfficeZone zone={layout.zones.office} isJa={isJa} />}
      {(layout.zones?.entrances || []).map((ent) => (
        <EntranceZone key={ent.id} entrance={ent} isJa={isJa} />
      ))}
      {(layout.zones?.kensaTables || []).map((kt) => (
        <KensaTable key={kt.id} position={kt.pos} size={kt.size} />
      ))}

      {/* Pair links on floor (e.g. OZNC pairs in 小瀬, or AOL-2/3 and AOL-4/5 in SCNA) */}
      {pairState.map((p) => (
        <PairLink
          key={`${p.a}-${p.b}`}
          a={ncPos[p.a]}
          b={ncPos[p.b]}
          together={p.together}
          color={STATUS_THEME[p.status]?.color || "#22d3ee"}
        />
      ))}

      {/* NC Cutters (OZNC01-18 in 小瀬, AOL-1..5 in SCNA) */}
      {(layout.ncMachines || []).map(({ id, pos }) => {
        const m = machinesById[id];
        const spec = {
          ...(layout.defaultSpecs?.[id] || {}),
          ...(m?.tableLength ? { tableLength: m.tableLength } : {}),
          ...(m?.noOfHead ? { noOfHead: m.noOfHead } : {}),
        };
        const status = effectiveStatus(m);
        const call = callsByMachine[id] || null;
        return (
          <NcCutter
            key={id}
            id={id}
            position={pos}
            noOfHead={spec.noOfHead || 1}
            tableLength={spec.tableLength || 1200}
            status={status}
            cycle={m?.cycle ?? null}
            call={call}
            selected={selectedId === id || (pairedTogether.has(id) && selectedId === machinesById[id]?.pair?.partner)}
            onSelect={onSelect}
          />
        );
      })}

      {/* MANAS Press (OZMANAS in 小瀬, SCNA-MANAS in SCNA) */}
      {layout.manas && (
        <ManasMachine
          id={layout.manas.id}
          position={layout.manas.pos}
          size={layout.manas.size}
          modelScale={layout.manas.modelScale || 1}
          status={effectiveStatus(machinesById[layout.manas.id])}
          cycle={machinesById[layout.manas.id]?.cycle ?? null}
          call={callsByMachine[layout.manas.id] || null}
          selected={selectedId === layout.manas.id}
          onSelect={onSelect}
        />
      )}

      {/* SCNA-PSA Machine(s) */}
      {psaMachines.map((psa) => {
        const m = machinesById[psa.id];
        const status = effectiveStatus(m);
        const call = callsByMachine[psa.id] || null;
        return (
          <PsaMachine
            key={psa.id}
            id={psa.id}
            position={psa.pos}
            size={psa.size}
            status={status}
            cycle={m?.cycle ?? null}
            call={call}
            selected={selectedId === psa.id}
            onSelect={onSelect}
          />
        );
      })}

      {/* SRS 1 & SRS 2 Machine(s) */}
      {srsMachines.map((srs) => {
        const m = machinesById[srs.id];
        const status = effectiveStatus(m);
        const call = callsByMachine[srs.id] || null;
        return (
          <SrsMachine
            key={srs.id}
            id={srs.id}
            position={srs.pos}
            size={srs.size}
            status={status}
            cycle={m?.cycle ?? null}
            call={call}
            selected={selectedId === srs.id}
            onSelect={onSelect}
          />
        );
      })}

      {/* ── 3D Per-Machine Call Animations (Leader Red Siren/Pulse, 3D Bouncing Box, 3D Material Roll) ── */}
      {(layout.ncMachines || []).map(({ id, pos }) => {
        const call = callsByMachine[id];
        if (!call) return null;
        const m = machinesById[id];
        const tableLength = m?.tableLength || layout.defaultSpecs?.[id]?.tableLength || 1200;
        return (
          <MachineCallEffect
            key={`call-fx-${id}`}
            call={call}
            position={pos}
            width={ncLengthFor(tableLength)}
            depth={NC_DEPTH}
            baseHeight={1.55}
          />
        );
      })}
      {layout.manas && callsByMachine[layout.manas.id] && (
        <MachineCallEffect
          call={callsByMachine[layout.manas.id]}
          position={layout.manas.pos}
          width={layout.manas.size[0]}
          depth={layout.manas.size[1] * 0.65}
          baseHeight={3.1 * (layout.manas.modelScale || 1)}
        />
      )}
      {psaMachines.map((psa) => {
        const call = callsByMachine[psa.id];
        if (!call) return null;
        return (
          <MachineCallEffect
            key={`call-fx-${psa.id}`}
            call={call}
            position={psa.pos}
            width={psa.size[0] * 0.9}
            depth={psa.size[1] * 0.85}
            baseHeight={2.05}
          />
        );
      })}
      {srsMachines.map((srs) => {
        const call = callsByMachine[srs.id];
        if (!call) return null;
        return (
          <MachineCallEffect
            key={`call-fx-${srs.id}`}
            call={call}
            position={srs.pos}
            width={srs.size[0] * 0.9}
            depth={srs.size[1] * 0.85}
            baseHeight={2.15}
          />
        );
      })}

      {/* Badges: one per solo NC machine, one shared badge per pair running together */}
      {(layout.ncMachines || [])
        .filter(({ id }) => !pairedTogether.has(id))
        .map(({ id, pos }) => {
          const m = machinesById[id];
          const live = liveMachines[id];
          const call = callsByMachine[id] || null;
          const status = effectiveStatus(m);
          const { value, unit } = badgeValue(m, isJa);
          const sebanggo = live?.sebanggo || m?.sebanggo || m?.activeRun?.sebanggo || null;
          return (
            <MachineBadge
              key={`badge-${id}`}
              machineId={id}
              position={pos}
              height={call ? 2.15 : 0.88}
              title={id}
              value={value}
              unit={unit}
              status={status}
              isJa={isJa}
              dim={status === "off"}
              selected={selectedId === id}
              sebanggo={sebanggo}
              call={call}
              totalNG={live?.totalNG || 0}
              onSelect={onSelect}
            />
          );
        })}
      {pairState
        .filter((p) => p.together)
        .map((p) => {
          const a = ncPos[p.a];
          const b = ncPos[p.b];
          const { value, unit } = badgeValue(p.lead, isJa, true);
          const sebanggo =
            p.lead?.pair?.sebanggo ||
            p.lead?.sebanggo ||
            machinesById[p.a]?.sebanggo ||
            machinesById[p.b]?.sebanggo ||
            null;
          const call = callsByMachine[p.a] || callsByMachine[p.b] || null;
          const totalNG = (liveMachines[p.a]?.totalNG || 0) + (liveMachines[p.b]?.totalNG || 0);
          return (
            <MachineBadge
              key={`badge-${p.a}-${p.b}`}
              machineId={p.lead?.id || p.a}
              position={[a[0], (a[1] + b[1]) / 2]}
              height={call ? 2.15 : 0.92}
              title={`${p.a.replace(/^OZ/, "")}⇄${p.b.replace(/^OZ/, "")}`}
              value={value}
              unit={unit}
              status={p.status}
              isJa={isJa}
              dim={p.status === "off"}
              selected={selectedId === p.a || selectedId === p.b}
              sebanggo={sebanggo}
              call={call}
              totalNG={totalNG}
              onSelect={onSelect}
            />
          );
        })}

      {/* MANAS Badge */}
      {layout.manas &&
        (() => {
          const mId = layout.manas.id;
          const m = machinesById[mId];
          const live = liveMachines[mId];
          const call = callsByMachine[mId] || null;
          const status = effectiveStatus(m);
          const { value, unit } = badgeValue(m, isJa);
          const sebanggo = live?.sebanggo || m?.sebanggo || null;
          const scale = layout.manas.modelScale || 1;
          return (
            <MachineBadge
              machineId={mId}
              position={layout.manas.pos}
              height={call ? 3.5 * scale : 2.35 * scale}
              title={layout.manas.title || "MANAS"}
              value={m?.hasCycleSensor ? value : sebanggo || value || "—"}
              unit={m?.hasCycleSensor ? unit : value !== "0" ? unit : ""}
              status={status}
              isJa={isJa}
              dim={status === "off"}
              selected={selectedId === mId}
              sebanggo={m?.hasCycleSensor ? sebanggo : null}
              call={call}
              totalNG={live?.totalNG || 0}
              onSelect={onSelect}
            />
          );
        })()}

      {/* SCNA-PSA Badges */}
      {psaMachines.map((psa) => {
        const m = machinesById[psa.id];
        const live = liveMachines[psa.id];
        const call = callsByMachine[psa.id] || null;
        const status = effectiveStatus(m);
        const { value, unit } = badgeValue(m, isJa);
        const sebanggo = live?.sebanggo || m?.sebanggo || m?.activeRun?.sebanggo || null;
        return (
          <MachineBadge
            key={`badge-${psa.id}`}
            machineId={psa.id}
            position={psa.pos}
            height={call ? 2.5 : 1.85}
            title={psa.title || psa.id}
            value={value}
            unit={unit}
            status={status}
            isJa={isJa}
            dim={status === "off"}
            selected={selectedId === psa.id}
            sebanggo={sebanggo}
            call={call}
            totalNG={live?.totalNG || 0}
            onSelect={onSelect}
          />
        );
      })}

      {/* SRS 1 & SRS 2 Badges */}
      {srsMachines.map((srs) => {
        const m = machinesById[srs.id];
        const live = liveMachines[srs.id];
        const call = callsByMachine[srs.id] || null;
        const status = effectiveStatus(m);
        const { value, unit } = badgeValue(m, isJa);
        const sebanggo = live?.sebanggo || m?.sebanggo || m?.activeRun?.sebanggo || null;
        return (
          <MachineBadge
            key={`badge-${srs.id}`}
            machineId={srs.id}
            position={srs.pos}
            height={call ? 2.45 : 2.15}
            title={srs.title || srs.id}
            value={value}
            unit={unit}
            status={status}
            isJa={isJa}
            dim={status === "off"}
            selected={selectedId === srs.id}
            sebanggo={sebanggo}
            call={call}
            totalNG={live?.totalNG || 0}
            onSelect={onSelect}
          />
        );
      })}

      {/* ── 3D Physical Call Monitor TV (factory-stopcall-tv.html) ── */}
      {showCallMonitor && callMonitor && (
        <StopCallMonitor3D
          monitor={callMonitor}
          machineIds={layoutMachineIds}
          activeCalls={activeCalls}
          machinesById={machinesById}
          isConnected={isCallStreamConnected}
          isJa={isJa}
          onOpenMonitor={onOpenCallMonitor}
          onSelectMachine={onSelect}
          editMode={editMode}
          isDragging={activeDrag?.type === "monitor"}
          onStartDrag={onStartDrag}
          onUpdateMonitorHeight={onUpdateMonitorHeight}
          onCommitPositions={onCommitPositions}
        />
      )}

      {/* ── Environmental Sensors with dynamic Heat Auras ── */}
      {showSensors &&
        sensors.map((sensor) => {
          const sId = sensor.id || sensor.deviceId;
          return (
            <SensorMarker
              key={sId}
              sensor={sensor}
              isJa={isJa}
              selected={selectedId === sId}
              onSelect={onSelect}
              showInfo={showSensorInfo}
              editMode={editMode}
              isDragging={activeDrag?.type === "sensor" && activeDrag?.id === sId}
              onStartDrag={onStartDrag}
            />
          );
        })}

      {/* ── Factory CCTV Cameras (3D stand + icon always visible; live 3D screen controlled by showCameras) ── */}
      {cameras.map((camera) => {
        const cId = camera.id || camera.streamId;
        return (
          <CameraMarker
            key={cId}
            camera={camera}
            isJa={isJa}
            showScreen={showCameras}
            onSelectCamera={onSelectCamera}
            editMode={editMode}
            isDragging={activeDrag?.type === "camera" && activeDrag?.id === cId}
            onStartDrag={onStartDrag}
            onRotateCamera={onRotateCamera}
          />
        );
      })}
    </>
  );
}

/**
 * Monitors WebGL renderer capabilities and sustained frame times.
 * Automatically activates Lite Mode on software/basic GPUs or if FPS drops below 26 FPS.
 */
function AdaptivePerformanceWatcher({ liteMode, onAutoLite }) {
  const { gl } = useThree();
  const sampleRef = useRef({ frames: 0, elapsed: 0, triggered: false });

  useEffect(() => {
    if (liteMode || sampleRef.current.triggered || !onAutoLite) return;
    try {
      const ctx = gl.getContext();
      const ext = ctx?.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        const renderer = String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "");
        if (/SwiftShader|llvmpipe|Software|Basic Render|Intel\(R\) HD Graphics/i.test(renderer)) {
          sampleRef.current.triggered = true;
          onAutoLite();
        }
      }
    } catch {
      // ignore
    }
  }, [gl, liteMode, onAutoLite]);

  useFrame((_, delta) => {
    if (liteMode || sampleRef.current.triggered || !onAutoLite) return;
    // Ignore tab-switch spikes > 250ms
    if (delta > 0.25) return;
    const s = sampleRef.current;
    s.frames += 1;
    s.elapsed += delta;
    if (s.elapsed >= 3.0) {
      const avgFps = s.frames / s.elapsed;
      if (avgFps < 26) {
        s.triggered = true;
        onAutoLite();
      } else {
        s.frames = 0;
        s.elapsed = 0;
      }
    }
  });

  return null;
}

/**
 * Full 3D digital twin of the factory floor (小瀬 or SCNA).
 * Supports interactive dragging & camera orientation in Edit Mode.
 */
export default function FactoryScene({
  factory = "小瀬",
  machinesById,
  selectedId,
  onSelect,
  isDark,
  isJa,
  viewKey = 0,
  drawerCovers = true,
  sensors = [],
  cameras = [],
  callMonitor = null,
  activeCalls = [],
  callsByMachine = {},
  liveMachines = {},
  isCallStreamConnected = false,
  onSelectCamera,
  onOpenCallMonitor,
  showSensors = true,
  showCameras = true,
  showCallMonitor = true,
  showSensorInfo = false,
  liteMode = false,
  onAutoLite,
  editMode = false,
  onUpdatePosition,
  onUpdateMonitorHeight,
  onRotateCamera,
  onCommitPositions,
}) {
  const colors = sceneColors(isDark);
  const layout = useMemo(() => getFactory3DLayout(factory), [factory]);
  const layoutMachineIds = useMemo(() => machineIdsFor(factory), [factory]);
  const selectedSensor = sensors.find((s) => (s.id || s.deviceId) === selectedId);
  const selectedPos = selectedId
    ? getMachinePositionForFactory(selectedId, factory) || selectedSensor?.pos || null
    : null;

  const [activeDrag, setActiveDrag] = useState(null);

  const handleStartDrag = (type, id) => {
    setActiveDrag({ type, id });
  };

  const handleEndDrag = () => {
    setActiveDrag((prev) => {
      if (prev && onCommitPositions) {
        onCommitPositions();
      }
      return null;
    });
  };

  // Cancel any drag if user exits editMode
  useEffect(() => {
    if (!editMode && activeDrag) {
      setActiveDrag(null);
    }
  }, [editMode, activeDrag]);

  return (
    <Canvas
      shadows={!liteMode}
      dpr={liteMode ? 1 : [1, 1.5]}
      camera={{ position: [0, 19, 14], fov: 40, near: 0.1, far: 200 }}
      onPointerMissed={() => {
        if (!activeDrag) onSelect(null);
      }}
      gl={{ antialias: !liteMode, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[colors.bg]} />
      <fog attach="fog" args={[colors.bg, 75, 145]} />

      <ambientLight intensity={isDark ? 0.45 : 0.6} />
      <hemisphereLight args={["#ffffff", isDark ? "#1e293b" : "#cbd5e1", isDark ? 0.55 : 0.7]} />
      <directionalLight
        position={[9, 18, 10]}
        intensity={isDark ? 1.5 : 1.8}
        castShadow={!liteMode}
        shadow-mapSize={[512, 512]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={1}
        shadow-camera-far={65}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-10, 8, -6]} intensity={0.35} />

      <AdaptivePerformanceWatcher liteMode={liteMode} onAutoLite={onAutoLite} />

      <FloorDragTracker
        floor={layout.floor}
        activeDrag={activeDrag}
        onUpdatePosition={onUpdatePosition}
        onEndDrag={handleEndDrag}
      />

      <Suspense fallback={null}>
        <FactoryContents
          layout={layout}
          layoutMachineIds={layoutMachineIds}
          machinesById={machinesById}
          selectedId={selectedId}
          onSelect={onSelect}
          isJa={isJa}
          colors={colors}
          sensors={sensors}
          cameras={cameras}
          callMonitor={callMonitor}
          activeCalls={activeCalls}
          callsByMachine={callsByMachine}
          liveMachines={liveMachines}
          isCallStreamConnected={isCallStreamConnected}
          onSelectCamera={onSelectCamera}
          onOpenCallMonitor={onOpenCallMonitor}
          showSensors={showSensors}
          showCameras={showCameras}
          showCallMonitor={showCallMonitor}
          showSensorInfo={showSensorInfo}
          editMode={editMode}
          activeDrag={activeDrag}
          onStartDrag={handleStartDrag}
          onUpdateMonitorHeight={onUpdateMonitorHeight}
          onCommitPositions={onCommitPositions}
          onRotateCamera={onRotateCamera}
        />
      </Suspense>

      <CameraRig
        floor={layout.floor}
        cameraView={layout.cameraView}
        selectedPos={selectedPos}
        drawerOpen={Boolean(selectedId) && drawerCovers}
        viewKey={viewKey}
        controlsEnabled={!activeDrag}
      />
    </Canvas>
  );
}
