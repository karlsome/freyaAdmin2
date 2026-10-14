import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Edges, Grid } from "@react-three/drei";
import { Html } from "./HtmlOverlay";
import NcCutter from "./NcCutter";
import ManasMachine from "./ManasMachine";
import SensorMarker from "./SensorMarker";
import CameraMarker from "./CameraMarker";
import MachineCallEffect from "./MachineCallEffect";
import StopCallMonitor3D from "./StopCallMonitor3D";
import { KOSE_LAYOUT, NC_DEPTH, getMachinePosition, ncLengthFor } from "../../data/factoryLayouts/kose";
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

const DEFAULT_TARGET = [0, 0, 0.6];
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

function sceneColors(isDark) {
  return isDark
    ? { bg: "#0b1220", floor: "#141c2b", cell: "#1e293b", section: "#2b3a52", wall: "#334155", label: "dark" }
    : { bg: "#eef2f7", floor: "#e4e9f0", cell: "#d3dbe6", section: "#bcc8d8", wall: "#94a3b8", label: "light" };
}

/* ── Camera rig: default overview + fly-to on selection ── */
function CameraRig({ selectedPos, drawerOpen, viewKey, controlsEnabled = true }) {
  const controlsRef = useRef();
  const { size } = useThree();

  const overview = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const k = 2 * Math.tan((40 * Math.PI) / 360);
    const dist = Math.max(17 / k, (KOSE_LAYOUT.floor.width + 2) / (k * aspect)) * 1.02;
    return {
      pos: DEFAULT_TARGET.map((t, i) => t + VIEW_DIR[i] * dist),
      target: DEFAULT_TARGET,
    };
  }, [size.width, size.height]);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    if (selectedPos) {
      const target = [selectedPos[0], 0.5, selectedPos[1]];
      const pos = target.map((t, i) => t + FOCUS_DIR[i] * 9);
      c.setLookAt(...pos, ...target, true);
      c.setFocalOffset(drawerOpen ? 1.8 : 0, 0, 0, true);
    } else {
      c.setFocalOffset(0, 0, 0, true);
      c.setLookAt(...overview.pos, ...overview.target, true);
    }
  }, [selectedPos, drawerOpen, overview, viewKey]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={controlsEnabled}
      minDistance={4}
      maxDistance={75}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2.35}
      smoothTime={0.45}
      dollySpeed={0.6}
    />
  );
}

/* ── Floor, walls and grid ── */
function Floor({ colors, onPointerDown, onPointerMove, onPointerUp }) {
  const { width, depth } = KOSE_LAYOUT.floor;
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
        fadeDistance={80}
        fadeStrength={0}
      />
      {[
        [0, -depth / 2, width + wall, wall],
        [0, depth / 2, width + wall, wall],
        [-width / 2, 0, wall, depth],
        [width / 2, 0, wall, depth],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.15, z]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.3, d]} />
          <meshStandardMaterial color={colors.wall} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

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

/* ── Meeting / break room ── */
function MeetingRoom({ isJa }) {
  const { pos, size } = KOSE_LAYOUT.room;
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
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[3.2, 0.06, 1.0]} />
        <meshStandardMaterial color="#d6b88d" roughness={0.7} />
      </mesh>
      {[-1.2, -0.4, 0.4, 1.2].flatMap((x) => [-0.8, 0.8].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.22, z]} castShadow>
          <boxGeometry args={[0.35, 0.44, 0.35]} />
          <meshStandardMaterial color="#64748b" roughness={0.7} />
        </mesh>
      )))}
      <SceneLabel position={[0, 1.9, 0]} icon="meeting_room" text={isJa ? "小瀬ガレージ / 会議室" : "Meeting / Break room"} tone="amber" />
    </group>
  );
}

/* ── Finished-goods pallet zone (decoration) ── */
function PalletZone({ isJa }) {
  const { pos, size } = KOSE_LAYOUT.pallet;
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
            <mesh key={z} position={[0, 0.05, z]} castShadow receiveShadow>
              <boxGeometry args={[1.25, 0.1, 0.16]} />
              <meshStandardMaterial color="#a47148" roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.25, 0.04, 1.0]} />
            <meshStandardMaterial color="#b98555" roughness={0.9} />
          </mesh>
          {stacks[pi].map(([bx, bz, level = 0], bi) => (
            <mesh key={bi} position={[bx - 0.25, 0.32 + level * 0.36, bz - 0.21]} castShadow receiveShadow>
              <boxGeometry args={[0.48, 0.36, 0.4]} />
              <meshStandardMaterial color={bi % 2 ? "#c8a27a" : "#d4b08a"} roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}
      <SceneLabel position={[0, 1.6, 0]} icon="inventory_2" text={isJa ? "出荷パレット" : "Finished-goods pallet"} tone="teal" />
    </group>
  );
}

/* ── Pair connection on the floor between paired machines ── */
function PairLink({ a, b, together, color }) {
  const ref = useRef();
  const x = a[0];
  const z1 = Math.min(a[1], b[1]) + NC_DEPTH / 2 + 0.05;
  const z2 = Math.max(a[1], b[1]) - NC_DEPTH / 2 - 0.05;
  const len = Math.max(0.05, z2 - z1);

  useFrame(({ clock }) => {
    if (ref.current && together) {
      const opacity = 0.65 + Math.sin(clock.getElapsedTime() * 3) * 0.25;
      ref.current.children.forEach((child) => { child.material.opacity = opacity; });
    }
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
}

/* ── Floating compact micro-badge above a machine ── */
function MachineBadge({
  position,
  height,
  title,
  value,
  unit,
  status,
  isJa,
  dim,
  onClick,
  selected,
  sebanggo,
  call,
  totalNG = 0,
}) {
  const theme = STATUS_THEME[status] || STATUS_THEME.off;
  const callTheme = call?.theme || null;
  const badgeColor = callTheme ? callTheme.color : theme.color;
  const shortTitle = String(title).replace(/OZ/g, "");
  const showStatusTag = !call && (status === "break" || status === "maintenance" || status === "cncCancel" || status === "stopCall");

  return (
    <Html position={[position[0], height, position[1]]} center zIndexRange={[30, 10]}>
      <button
        type="button"
        onClick={onClick}
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
}

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
function FloorDragTracker({ activeDrag, onUpdatePosition, onEndDrag }) {
  const { camera, gl } = useThree();

  useEffect(() => {
    if (!activeDrag) return undefined;

    const hw = KOSE_LAYOUT.floor.width / 2 - 0.5;
    const hd = KOSE_LAYOUT.floor.depth / 2 - 0.5;

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
  }, [activeDrag, camera, gl, onUpdatePosition, onEndDrag]);

  return null;
}

/* ── Scene contents ── */
function FactoryContents({
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
  const ncPos = useMemo(() => Object.fromEntries(KOSE_LAYOUT.ncMachines.map((m) => [m.id, m.pos])), []);

  const pairState = useMemo(() => KOSE_LAYOUT.pairs.map(([a, b]) => {
    const ma = machinesById[a];
    const mb = machinesById[b];
    const together = Boolean(ma?.pair?.together || mb?.pair?.together);
    const lead = ma?.pair?.together ? ma : mb;
    return { a, b, together, lead, status: together ? effectiveStatus(lead) : null };
  }), [machinesById]);

  const pairedTogether = new Set(pairState.filter((p) => p.together).flatMap((p) => [p.a, p.b]));

  return (
    <>
      <Floor colors={colors} />

      <MeetingRoom isJa={isJa} />
      <PalletZone isJa={isJa} />

      {pairState.map((p) => (
        <PairLink
          key={`${p.a}-${p.b}`}
          a={ncPos[p.a]}
          b={ncPos[p.b]}
          together={p.together}
          color={STATUS_THEME[p.status]?.color || "#22d3ee"}
        />
      ))}

      {KOSE_LAYOUT.ncMachines.map(({ id, pos }) => {
        const m = machinesById[id];
        const spec = { ...KOSE_LAYOUT.defaultSpecs[id], ...(m?.tableLength ? { tableLength: m.tableLength } : {}), ...(m?.noOfHead ? { noOfHead: m.noOfHead } : {}) };
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

      <ManasMachine
        id={KOSE_LAYOUT.manas.id}
        position={KOSE_LAYOUT.manas.pos}
        size={KOSE_LAYOUT.manas.size}
        status={effectiveStatus(machinesById[KOSE_LAYOUT.manas.id])}
        cycle={machinesById[KOSE_LAYOUT.manas.id]?.cycle ?? null}
        call={callsByMachine[KOSE_LAYOUT.manas.id] || null}
        selected={selectedId === KOSE_LAYOUT.manas.id}
        onSelect={onSelect}
      />

      {/* ── 3D Per-Machine Call Animations (Leader Red Siren/Pulse, 3D Bouncing Box, 3D Material Roll) ── */}
      {KOSE_LAYOUT.ncMachines.map(({ id, pos }) => {
        const call = callsByMachine[id];
        if (!call) return null;
        const m = machinesById[id];
        const tableLength = m?.tableLength || KOSE_LAYOUT.defaultSpecs[id]?.tableLength || 1200;
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
      {callsByMachine[KOSE_LAYOUT.manas.id] && (
        <MachineCallEffect
          call={callsByMachine[KOSE_LAYOUT.manas.id]}
          position={KOSE_LAYOUT.manas.pos}
          width={KOSE_LAYOUT.manas.size[0]}
          depth={KOSE_LAYOUT.manas.size[1] * 0.65}
          baseHeight={3.1}
        />
      )}

      {/* Badges: one per machine, one shared badge per pair running together */}
      {KOSE_LAYOUT.ncMachines.filter(({ id }) => !pairedTogether.has(id)).map(({ id, pos }) => {
        const m = machinesById[id];
        const live = liveMachines[id];
        const call = callsByMachine[id] || null;
        const status = effectiveStatus(m);
        const { value, unit } = badgeValue(m, isJa);
        const sebanggo = live?.sebanggo || m?.sebanggo || m?.activeRun?.sebanggo || null;
        return (
          <MachineBadge
            key={`badge-${id}`}
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
            onClick={() => onSelect(id)}
          />
        );
      })}
      {pairState.filter((p) => p.together).map((p) => {
        const a = ncPos[p.a];
        const b = ncPos[p.b];
        const { value, unit } = badgeValue(p.lead, isJa, true);
        const sebanggo = p.lead?.pair?.sebanggo || p.lead?.sebanggo || machinesById[p.a]?.sebanggo || machinesById[p.b]?.sebanggo || null;
        const call = callsByMachine[p.a] || callsByMachine[p.b] || null;
        const totalNG = (liveMachines[p.a]?.totalNG || 0) + (liveMachines[p.b]?.totalNG || 0);
        return (
          <MachineBadge
            key={`badge-${p.a}-${p.b}`}
            position={[a[0], (a[1] + b[1]) / 2]}
            height={call ? 2.15 : 0.92}
            title={`${p.a.replace("OZ", "")}⇄${p.b.replace("OZ", "")}`}
            value={value}
            unit={unit}
            status={p.status}
            isJa={isJa}
            dim={p.status === "off"}
            selected={selectedId === p.a || selectedId === p.b}
            sebanggo={sebanggo}
            call={call}
            totalNG={totalNG}
            onClick={() => onSelect(p.lead?.id || p.a)}
          />
        );
      })}
      {(() => {
        const m = machinesById[KOSE_LAYOUT.manas.id];
        const live = liveMachines[KOSE_LAYOUT.manas.id];
        const call = callsByMachine[KOSE_LAYOUT.manas.id] || null;
        const status = effectiveStatus(m);
        const { value, unit } = badgeValue(m, isJa);
        const sebanggo = live?.sebanggo || m?.sebanggo || null;
        return (
          <MachineBadge
            position={KOSE_LAYOUT.manas.pos}
            height={call ? 3.7 : 2.35}
            title="MANAS"
            value={m?.hasCycleSensor ? value : (sebanggo || "—")}
            unit={m?.hasCycleSensor ? unit : ""}
            status={status}
            isJa={isJa}
            dim={status === "off"}
            selected={selectedId === KOSE_LAYOUT.manas.id}
            sebanggo={m?.hasCycleSensor ? sebanggo : null}
            call={call}
            totalNG={live?.totalNG || 0}
            onClick={() => onSelect(KOSE_LAYOUT.manas.id)}
          />
        );
      })()}

      {/* ── 3D Physical Call Monitor TV (factory-stopcall-tv.html) ── */}
      {showCallMonitor && callMonitor && (
        <StopCallMonitor3D
          monitor={callMonitor}
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

      {/* ── Factory CCTV Cameras with live stream pop-up ── */}
      {showCameras &&
        cameras.map((camera) => {
          const cId = camera.id || camera.streamId;
          return (
            <CameraMarker
              key={cId}
              camera={camera}
              isJa={isJa}
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
 * Full 3D digital twin of the 小瀬 floor.
 * Supports interactive dragging & camera orientation in Edit Mode.
 */
export default function FactoryScene({
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
  editMode = false,
  onUpdatePosition,
  onUpdateMonitorHeight,
  onRotateCamera,
  onCommitPositions,
}) {
  const colors = sceneColors(isDark);
  const selectedSensor = sensors.find((s) => (s.id || s.deviceId) === selectedId);
  const selectedPos = selectedId ? (getMachinePosition(selectedId) || selectedSensor?.pos || null) : null;

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
      shadows="soft"
      dpr={[1, 2]}
      camera={{ position: [0, 19, 14], fov: 40, near: 0.1, far: 200 }}
      onPointerMissed={() => {
        if (!activeDrag) onSelect(null);
      }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[colors.bg]} />
      <fog attach="fog" args={[colors.bg, 70, 130]} />

      <ambientLight intensity={isDark ? 0.45 : 0.6} />
      <hemisphereLight args={["#ffffff", isDark ? "#1e293b" : "#cbd5e1", isDark ? 0.55 : 0.7]} />
      <directionalLight
        position={[9, 18, 10]}
        intensity={isDark ? 1.5 : 1.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-10, 8, -6]} intensity={0.35} />

      <FloorDragTracker
        activeDrag={activeDrag}
        onUpdatePosition={onUpdatePosition}
        onEndDrag={handleEndDrag}
      />

      <Suspense fallback={null}>
        <FactoryContents
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
        selectedPos={selectedPos}
        drawerOpen={Boolean(selectedId) && drawerCovers}
        viewKey={viewKey}
        controlsEnabled={!activeDrag}
      />
    </Canvas>
  );
}

