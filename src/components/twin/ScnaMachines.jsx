import { memo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import StatusGlow from "./StatusGlow";
import { phaseFor, useCycleFlash } from "./twinHooks";

const BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const CYL_GEO = new THREE.CylinderGeometry(1, 1, 1, 16);

const MAT_BASE = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.7 });
const MAT_FRAME = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.45, metalness: 0.15 });
const MAT_DARK_METAL = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5, metalness: 0.4 });
const MAT_STEEL = new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.35, metalness: 0.6 });
const MAT_ROLL_RAW = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.65 });
const MAT_ROLL_CORE = new THREE.MeshStandardMaterial({ color: "#b45309", roughness: 0.8 });
const MAT_WEB_PSA = new THREE.MeshStandardMaterial({ color: "#38bdf8", roughness: 0.4, transparent: true, opacity: 0.82 });
const MAT_WEB_STRIPE = new THREE.MeshStandardMaterial({ color: "#0284c7", roughness: 0.4 });
const MAT_SCREEN_ON = new THREE.MeshStandardMaterial({ color: "#0f172a", emissive: "#38bdf8", emissiveIntensity: 0.55 });
const MAT_SCREEN_OFF = new THREE.MeshStandardMaterial({ color: "#0f172a", emissive: "#38bdf8", emissiveIntensity: 0.05 });

// SRS 6-head heat-transfer stamping machine materials
const MAT_SRS_ALU = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.35, metalness: 0.55 });
const MAT_SRS_TABLE = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.5, metalness: 0.3 });
const MAT_SRS_CAGE_YELLOW = new THREE.MeshStandardMaterial({ color: "#eab308", roughness: 0.4, metalness: 0.15 });
const MAT_SRS_CAGE_MESH = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.65, metalness: 0.35 });
const MAT_SRS_BLUE_BOARD = new THREE.MeshStandardMaterial({ color: "#60a5fa", roughness: 0.55 });
const MAT_SRS_POSTER = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.7 });
const MAT_SRS_PART = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.75 });
const MAT_SRS_SIGN_BLUE = new THREE.MeshStandardMaterial({ color: "#2563eb", roughness: 0.45 });
const MAT_SRS_SIGN_GREEN = new THREE.MeshStandardMaterial({ color: "#16a34a", roughness: 0.45 });
const MAT_SRS_WOOD = new THREE.MeshStandardMaterial({ color: "#d4a373", roughness: 0.75 });
const MAT_SRS_WHITE_FRAME = new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.45, metalness: 0.15 });
const MAT_SRS_CARDBOARD = new THREE.MeshStandardMaterial({ color: "#b08968", roughness: 0.85 });
const MAT_SRS_ESTOP = new THREE.MeshStandardMaterial({ color: "#ef4444", emissive: "#ef4444", emissiveIntensity: 0.45 });
const MAT_SRS_LAMP_GREEN = new THREE.MeshStandardMaterial({ color: "#22c55e", emissive: "#22c55e", emissiveIntensity: 0.8 });
const MAT_SRS_LAMP_AMBER = new THREE.MeshStandardMaterial({ color: "#f59e0b", emissive: "#f59e0b", emissiveIntensity: 0.75 });

// Japanese Kensa (Inspection) Table materials
const MAT_KENSA_FRAME = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.45, metalness: 0.2 });
const MAT_KENSA_TRIM = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.6 });
const MAT_KENSA_GREEN_MAT = new THREE.MeshStandardMaterial({ color: "#0d9488", roughness: 0.55 });
const MAT_KENSA_GREEN_BOARD = new THREE.MeshStandardMaterial({ color: "#15803d", roughness: 0.5 });
const MAT_KENSA_SHELF = new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.5 });
const MAT_KENSA_LIGHT = new THREE.MeshStandardMaterial({
  color: "#f8fafc",
  emissive: "#e0f2fe",
  emissiveIntensity: 0.75,
  toneMapped: false,
});

function resolveCallColor(call) {
  if (!call) return null;
  if (call.leader) return "#ef4444";
  if (call.stop) return "#a855f7";
  if (call.box) return "#f59e0b";
  if (call.material) return "#3b82f6";
  return null;
}

/**
 * 3D model for SCNA-PSA: wide roll-to-roll PSA laminating & adhesive coating line.
 * Features unwind/rewind stands, nip rollers, central coating bridge with safety guard,
 * animated web feed when running, and operator control cabinet.
 */
export const PsaMachine = memo(function PsaMachine({
  id,
  position,
  size = [7.6, 2.7],
  status,
  selected,
  cycle,
  call,
  onSelect,
}) {
  const [w, d] = size;
  const running = status === "running";
  const phase = phaseFor(id);
  const groupRef = useRef();
  const bodyMatRef = useRef();
  const webStripesRef = useRef();
  const rollLeftRef = useRef();
  const rollRightRef = useRef();
  const beaconMatRef = useRef();
  const [hovered, setHovered] = useState(false);
  const flashRef = useCycleFlash(cycle);

  const callColor = resolveCallColor(call);
  const effectiveGlowStatus = call?.leader || call?.stop ? "stopCall" : status;

  useFrame(({ clock }, delta) => {
    const targetLift = hovered || selected ? 0.06 : 0;
    const grpY = groupRef.current ? Math.abs(groupRef.current.position.y - targetLift) : 0;

    if (!running && !callColor && grpY < 0.001) {
      if (bodyMatRef.current && bodyMatRef.current.emissiveIntensity !== 0) {
        bodyMatRef.current.emissiveIntensity = 0;
      }
      if (beaconMatRef.current) {
        beaconMatRef.current.emissiveIntensity = status === "off" ? 0.1 : 0.7;
      }
      return;
    }

    const t = clock.getElapsedTime();
    const k = Math.min(1, delta * 4);
    if (groupRef.current) {
      groupRef.current.position.y += (targetLift - groupRef.current.position.y) * k;
    }
    if (bodyMatRef.current) {
      if (callColor) {
        const pulse = (Math.sin(t * (call?.leader ? 8 : 4.5)) + 1) * 0.5;
        bodyMatRef.current.emissive.set(callColor);
        bodyMatRef.current.emissiveIntensity = 0.18 + pulse * (call?.leader ? 0.6 : 0.35);
      } else if (bodyMatRef.current.emissiveIntensity !== 0) {
        bodyMatRef.current.emissiveIntensity = 0;
      }
    }
    if (beaconMatRef.current) {
      beaconMatRef.current.emissiveIntensity = callColor
        ? 2.6 + Math.sin(t * 9) * 1.4
        : running
          ? 1.9 + Math.sin(t * 5 + phase) * 0.5
          : status === "off"
            ? 0.1
            : 0.7;
    }
    if (running) {
      if (webStripesRef.current) {
        webStripesRef.current.children.forEach((child, i) => {
          const prog = (t * 0.42 + i / 4 + phase) % 1;
          child.position.x = -2.2 + prog * 4.4;
        });
      }
      if (rollLeftRef.current) rollLeftRef.current.rotation.y = t * 1.4;
      if (rollRightRef.current) rollRightRef.current.rotation.y = t * 1.4;
    }
  });

  const handlePointer = (over) => (e) => {
    e.stopPropagation();
    setHovered(over);
    document.body.style.cursor = over ? "pointer" : "";
  };

  return (
    <group position={[position[0], 0, position[1]]}>
      <StatusGlow
        width={w * 0.94}
        depth={d * 0.92}
        status={effectiveGlowStatus}
        selected={selected}
        flashRef={flashRef}
      />

      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(id);
        }}
        onPointerOver={handlePointer(true)}
        onPointerOut={handlePointer(false)}
      >
        {/* Heavy base frame */}
        <mesh position={[0, 0.16, 0]} scale={[w * 0.88, 0.32, d * 0.76]} geometry={BOX_GEO} material={MAT_BASE} castShadow receiveShadow />
        <mesh position={[0, 0.48, 0]} scale={[w * 0.84, 0.34, d * 0.7]} geometry={BOX_GEO} receiveShadow>
          <meshStandardMaterial ref={bodyMatRef} color="#dde3ea" roughness={0.45} metalness={0.15} />
        </mesh>

        {/* Central PSA laminating / coating bridge */}
        <mesh position={[0, 1.05, 0]} scale={[2.4, 0.82, d * 0.74]} geometry={BOX_GEO} material={MAT_FRAME} castShadow receiveShadow />
        <mesh position={[0, 1.56, 0]}>
          <boxGeometry args={[2.5, 0.32, d * 0.76]} />
          <meshStandardMaterial color="#facc15" transparent opacity={0.18} depthWrite={false} />
          <Edges color="#eab308" />
        </mesh>

        {/* Status light bar on top of bridge */}
        <mesh position={[0, 1.76, 0]} scale={[1.1, 0.06, 0.12]} geometry={BOX_GEO}>
          <meshStandardMaterial
            ref={beaconMatRef}
            color={callColor || (running ? "#22c55e" : "#f59e0b")}
            emissive={callColor || (running ? "#22c55e" : "#f59e0b")}
            emissiveIntensity={status === "off" ? 0.1 : 1.2}
            toneMapped={false}
          />
        </mesh>

        {/* Web material sheet & animated flow stripes */}
        <mesh position={[0, 0.68, 0]} scale={[4.8, 0.02, d * 0.56]} geometry={BOX_GEO} material={MAT_WEB_PSA} />
        <group ref={webStripesRef} position={[0, 0.695, 0]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[-2.2 + (i / 4) * 4.4, 0, 0]} scale={[0.07, 0.008, d * 0.54]} geometry={BOX_GEO} material={MAT_WEB_STRIPE} />
          ))}
        </group>

        {/* Unwind & Rewind Large Material Rolls (left & right) */}
        {[-2.55, 2.55].map((rx, idx) => (
          <group key={rx} position={[rx, 0.76, 0]}>
            {/* Side stanchions */}
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[0, 0, side * (d * 0.31)]}
                scale={[0.38, 0.58, 0.1]}
                geometry={BOX_GEO}
                material={MAT_DARK_METAL}
              />
            ))}
            {/* Cylindrical roll */}
            <group ref={idx === 0 ? rollLeftRef : rollRightRef} rotation={[Math.PI / 2, 0, 0]}>
              <mesh scale={[0.36, d * 0.55, 0.36]} geometry={CYL_GEO} material={MAT_ROLL_RAW} castShadow />
              <mesh scale={[0.12, d * 0.64, 0.12]} geometry={CYL_GEO} material={MAT_ROLL_CORE} />
            </group>
          </group>
        ))}

        {/* Guide rollers */}
        {[-1.55, 1.55].map((gx) => (
          <mesh
            key={gx}
            position={[gx, 0.72, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[0.09, d * 0.62, 0.09]}
            geometry={CYL_GEO}
            material={MAT_STEEL}
          />
        ))}

        {/* Front Operator Control Console */}
        <group position={[-1.6, 0, d * 0.42]}>
          <mesh position={[0, 0.48, 0]} scale={[0.55, 0.96, 0.28]} geometry={BOX_GEO} material={MAT_DARK_METAL} />
          <mesh
            position={[0, 0.72, 0.145]}
            scale={[0.36, 0.24, 0.01]}
            geometry={BOX_GEO}
            material={status === "off" ? MAT_SCREEN_OFF : MAT_SCREEN_ON}
          />
        </group>
      </group>
    </group>
  );
});

const SRS_CAGE_XS = [-1.14, -0.58, -0.02, 0.54];
const SRS_LEG_XS = [-1.38, -0.3, 0.78];
const SRS_LEG_ZS = [-0.58, 0.42];
const SRS_BUTTON_BOX_XS = [-1.08, -0.58, 0.02, 0.48];
const SRS_KNOB_XS = [-0.36, -0.22, -0.08, 0.06, 0.2];

/**
 * 3D model for SRS 1 & SRS 2: 4-head SRS mark heat-transfer stamping press workstation
 * (SRSマーク熱転写加工機).
 * Oriented to face the AOL machines (-Z direction):
 *   - 4 vertical yellow mesh safety guard cages in a row along X
 *   - Aluminum T-slot extrusion base frame + lower electrical control cabinet with indicator lamps
 *   - Dark metallic worktable with die-cut automotive trim parts and front push-button switch boxes
 *   - Tall light-blue backboard (+Z side) with work instruction posters, top station signs, and overhead LED light bar
 *   - Side 2-tier wooden/white-frame stand holding stacks of die-cut parts
 */
export const SrsMachine = memo(function SrsMachine({
  id,
  position,
  size = [3.3, 2.6],
  status,
  selected,
  cycle,
  call,
  onSelect,
}) {
  const [w, d] = size;
  const running = status === "running";
  const phase = phaseFor(id);
  const groupRef = useRef();
  const bodyMatRef = useRef();
  const ramsRef = useRef();
  const beaconMatRef = useRef();
  const [hovered, setHovered] = useState(false);
  const flashRef = useCycleFlash(cycle);

  const callColor = resolveCallColor(call);
  const effectiveGlowStatus = call?.leader || call?.stop ? "stopCall" : status;

  useFrame(({ clock }, delta) => {
    const targetLift = hovered || selected ? 0.06 : 0;
    const grpY = groupRef.current ? Math.abs(groupRef.current.position.y - targetLift) : 0;

    if (!running && !callColor && grpY < 0.001) {
      if (bodyMatRef.current && bodyMatRef.current.emissiveIntensity !== 0) {
        bodyMatRef.current.emissiveIntensity = 0;
      }
      if (beaconMatRef.current) {
        beaconMatRef.current.emissiveIntensity = status === "off" ? 0.15 : 0.85;
      }
      return;
    }

    const t = clock.getElapsedTime();
    const k = Math.min(1, delta * 4);
    if (groupRef.current) {
      groupRef.current.position.y += (targetLift - groupRef.current.position.y) * k;
    }
    if (bodyMatRef.current) {
      if (callColor) {
        const pulse = (Math.sin(t * (call?.leader ? 8 : 4.5)) + 1) * 0.5;
        bodyMatRef.current.emissive.set(callColor);
        bodyMatRef.current.emissiveIntensity = 0.18 + pulse * (call?.leader ? 0.6 : 0.35);
      } else if (bodyMatRef.current.emissiveIntensity !== 0) {
        bodyMatRef.current.emissiveIntensity = 0;
      }
    }
    if (beaconMatRef.current) {
      beaconMatRef.current.emissiveIntensity = callColor
        ? 2.6 + Math.sin(t * 9) * 1.4
        : running
          ? 1.9 + Math.sin(t * 5.5 + phase) * 0.45
          : status === "off"
            ? 0.15
            : 0.85;
    }
    if (running && ramsRef.current) {
      ramsRef.current.children.forEach((ram, idx) => {
        const wave = Math.max(0, Math.sin(t * 3.8 + idx * 0.95 + phase));
        ram.position.y = 1.0 - wave * 0.14;
      });
    }
  });

  const handlePointer = (over) => (e) => {
    e.stopPropagation();
    setHovered(over);
    document.body.style.cursor = over ? "pointer" : "";
  };

  return (
    <group position={[position[0], 0, position[1]]}>
      <StatusGlow
        width={w * 0.94}
        depth={d * 0.92}
        status={effectiveGlowStatus}
        selected={selected}
        flashRef={flashRef}
      />

      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(id);
        }}
        onPointerOver={handlePointer(true)}
        onPointerOut={handlePointer(false)}
      >
        {/* ── 1. Aluminum T-Slot Extrusion Base Frame ── */}
        {SRS_LEG_XS.flatMap((lx) =>
          SRS_LEG_ZS.map((lz) => (
            <group key={`${lx}-${lz}`} position={[lx, 0, lz]}>
              <mesh position={[0, 0.37, 0]} scale={[0.065, 0.68, 0.065]} geometry={BOX_GEO} material={MAT_SRS_ALU} castShadow />
              <mesh position={[0, 0.025, 0]} scale={[0.04, 0.05, 0.04]} geometry={CYL_GEO} material={MAT_DARK_METAL} />
            </group>
          ))
        )}
        {/* Lower horizontal aluminum tie-beams */}
        <mesh position={[-0.3, 0.11, -0.58]} scale={[2.22, 0.055, 0.055]} geometry={BOX_GEO} material={MAT_SRS_ALU} />
        <mesh position={[-0.3, 0.11, 0.42]} scale={[2.22, 0.055, 0.055]} geometry={BOX_GEO} material={MAT_SRS_ALU} />
        {SRS_LEG_XS.map((lx) => (
          <mesh key={`tie-${lx}`} position={[lx, 0.11, -0.08]} scale={[0.055, 0.055, 1.04]} geometry={BOX_GEO} material={MAT_SRS_ALU} />
        ))}

        {/* ── 2. Lower Recessed Electrical Control Cabinet (faces -Z toward AOLs) ── */}
        <group position={[-0.12, 0.39, -0.34]}>
          <mesh scale={[0.96, 0.48, 0.44]} geometry={BOX_GEO} castShadow receiveShadow>
            <meshStandardMaterial ref={bodyMatRef} color="#cbd5e1" roughness={0.45} metalness={0.2} />
          </mesh>
          {/* Indicator lamps row (2 amber, 3 green, 1 red E-stop) on -Z face */}
          {[-0.36, -0.24].map((ix) => (
            <mesh key={`amb-${ix}`} position={[ix, 0.09, -0.225]} rotation={[Math.PI / 2, 0, 0]} scale={[0.022, 0.015, 0.022]} geometry={CYL_GEO} material={MAT_SRS_LAMP_AMBER} />
          ))}
          {[-0.12, 0.0, 0.12].map((ix) => (
            <mesh key={`grn-${ix}`} position={[ix, 0.09, -0.225]} rotation={[Math.PI / 2, 0, 0]} scale={[0.022, 0.015, 0.022]} geometry={CYL_GEO} material={MAT_SRS_LAMP_GREEN} />
          ))}
          <mesh position={[0.28, 0.07, -0.23]} rotation={[Math.PI / 2, 0, 0]} scale={[0.036, 0.025, 0.036]} geometry={CYL_GEO} material={MAT_SRS_ESTOP} />
          {/* Black rotary selector switches row */}
          {SRS_KNOB_XS.map((kx) => (
            <mesh key={`knob-${kx}`} position={[kx, -0.04, -0.225]} rotation={[Math.PI / 2, 0, 0]} scale={[0.02, 0.018, 0.02]} geometry={CYL_GEO} material={MAT_DARK_METAL} />
          ))}
        </group>

        {/* Foreground open cardboard parts box on floor in front of cabinet */}
        <group position={[0.05, 0.21, -0.86]}>
          <mesh scale={[0.48, 0.4, 0.34]} geometry={BOX_GEO} material={MAT_SRS_CARDBOARD} castShadow receiveShadow />
          <mesh position={[0, 0.205, 0]} scale={[0.44, 0.01, 0.3]} geometry={BOX_GEO} material={MAT_SRS_PART} />
        </group>

        {/* ── 3. Main Metallic Worktable & Front Operator Push-Button Stations ── */}
        <mesh position={[-0.3, 0.72, -0.08]} scale={[2.32, 0.055, 1.12]} geometry={BOX_GEO} material={MAT_SRS_ALU} castShadow receiveShadow />
        <mesh position={[-0.3, 0.752, -0.08]} scale={[2.24, 0.018, 1.04]} geometry={BOX_GEO} material={MAT_SRS_TABLE} receiveShadow />

        {/* Die-cut dark automotive trim workpieces on the worktable */}
        {[-0.96, -0.3, 0.36].map((wx) => (
          <group key={`wp-${wx}`} position={[wx, 0.768, -0.24]}>
            <mesh scale={[0.42, 0.014, 0.34]} geometry={BOX_GEO} material={MAT_SRS_PART} />
            <mesh position={[0, 0.008, 0.02]} scale={[0.14, 0.006, 0.09]} geometry={BOX_GEO} material={MAT_SRS_TABLE} />
          </group>
        ))}

        {/* Front protruding two-hand start push-button boxes + central red E-stop */}
        {SRS_BUTTON_BOX_XS.map((bx) => (
          <group key={`btn-${bx}`} position={[bx, 0.71, -0.71]}>
            <mesh scale={[0.21, 0.1, 0.16]} geometry={BOX_GEO} material={MAT_SRS_ALU} castShadow />
            <mesh position={[0, 0.06, 0]} scale={[0.032, 0.025, 0.032]} geometry={CYL_GEO} material={MAT_STEEL} />
          </group>
        ))}
        <group position={[-0.28, 0.72, -0.7]}>
          <mesh scale={[0.18, 0.09, 0.15]} geometry={BOX_GEO} material={MAT_DARK_METAL} />
          <mesh position={[0, 0.06, 0]} scale={[0.034, 0.03, 0.034]} geometry={CYL_GEO} material={MAT_SRS_ESTOP} />
        </group>

        {/* ── 4. Row of 4 Yellow Mesh Safety Guard Cages & Heat-Transfer Press Heads ── */}
        {/* Horizontal rear support beam behind the 4 cages */}
        <mesh position={[-0.3, 1.04, 0.3]} scale={[2.16, 0.09, 0.08]} geometry={BOX_GEO} material={MAT_SRS_ALU} />

        {/* Animated press rams inside the 4 stations */}
        <group ref={ramsRef}>
          {SRS_CAGE_XS.map((cx) => (
            <group key={`ram-${cx}`} position={[cx, 1.0, 0.16]}>
              <mesh scale={[0.12, 0.22, 0.12]} geometry={BOX_GEO} material={MAT_STEEL} />
              <mesh position={[0, -0.14, -0.02]} scale={[0.16, 0.03, 0.14]} geometry={BOX_GEO} material={MAT_DARK_METAL} />
            </group>
          ))}
        </group>

        {/* 4 Yellow rectangular mesh safety cages */}
        {SRS_CAGE_XS.map((cx) => (
          <group key={`cage-${cx}`} position={[cx, 1.04, 0.08]}>
            {/* Yellow outer cage housing */}
            <mesh scale={[0.24, 0.54, 0.22]} geometry={BOX_GEO} material={MAT_SRS_CAGE_YELLOW} castShadow receiveShadow />
            {/* Front (-Z) upper & lower dark diamond-mesh window cutouts */}
            <mesh position={[0, 0.11, -0.112]} scale={[0.16, 0.18, 0.008]} geometry={BOX_GEO} material={MAT_SRS_CAGE_MESH} />
            <mesh position={[0, -0.11, -0.112]} scale={[0.16, 0.18, 0.008]} geometry={BOX_GEO} material={MAT_SRS_CAGE_MESH} />
            {/* Side (±X) dark mesh window cutouts */}
            <mesh position={[-0.121, 0.02, 0]} scale={[0.008, 0.38, 0.14]} geometry={BOX_GEO} material={MAT_SRS_CAGE_MESH} />
            <mesh position={[0.121, 0.02, 0]} scale={[0.008, 0.38, 0.14]} geometry={BOX_GEO} material={MAT_SRS_CAGE_MESH} />
            {/* Actuator mount block behind cage */}
            <mesh position={[0, 0.04, 0.15]} scale={[0.15, 0.32, 0.1]} geometry={BOX_GEO} material={MAT_DARK_METAL} />
          </group>
        ))}

        {/* ── 5. Tall Light-Blue Backboard with Work Instruction Posters & Overhead Light ── */}
        <group position={[-0.3, 0, 0.45]}>
          {/* Light-blue partition board */}
          <mesh position={[0, 1.32, 0]} scale={[2.26, 1.18, 0.055]} geometry={BOX_GEO} material={MAT_SRS_BLUE_BOARD} castShadow receiveShadow />

          {/* Center-top instruction poster (SRSマーク熱転写加工一覧 with 4 dark part silhouettes) */}
          <mesh position={[-0.02, 1.56, -0.032]} scale={[0.66, 0.38, 0.008]} geometry={BOX_GEO} material={MAT_SRS_POSTER} />
          {[-0.15, 0.15].flatMap((px) =>
            [1.62, 1.49].map((py) => (
              <mesh key={`sil-${px}-${py}`} position={[-0.02 + px, py, -0.038]} scale={[0.22, 0.065, 0.006]} geometry={BOX_GEO} material={MAT_SRS_PART} />
            ))
          )}

          {/* Center-bottom instruction poster (2 blue/dark part diagrams) */}
          <mesh position={[-0.02, 1.14, -0.032]} scale={[0.66, 0.34, 0.008]} geometry={BOX_GEO} material={MAT_SRS_POSTER} />
          {[-0.15, 0.15].map((px) => (
            <mesh key={`sil2-${px}`} position={[-0.02 + px, 1.13, -0.038]} scale={[0.24, 0.14, 0.006]} geometry={BOX_GEO} material={MAT_SRS_PART} />
          ))}

          {/* Left (+X) instruction checklists */}
          <mesh position={[0.68, 1.62, -0.032]} scale={[0.36, 0.34, 0.008]} geometry={BOX_GEO} material={MAT_SRS_POSTER} />
          <mesh position={[0.68, 1.24, -0.032]} scale={[0.38, 0.28, 0.008]} geometry={BOX_GEO} material={MAT_SRS_POSTER} />

          {/* Right (-X) laminated work standard sheets & warning sign */}
          <mesh position={[-0.64, 1.62, -0.035]} scale={[0.38, 0.42, 0.01]} geometry={BOX_GEO} material={MAT_SRS_POSTER} />
          <mesh position={[-0.64, 1.16, -0.035]} scale={[0.38, 0.38, 0.01]} geometry={BOX_GEO} material={MAT_SRS_POSTER} />
          {/* Side warning plaque ("作業(検査)中の話しかけ禁止") */}
          <mesh position={[-1.08, 1.54, -0.035]} scale={[0.42, 0.28, 0.012]} geometry={BOX_GEO} material={MAT_SRS_POSTER} />

          {/* Top hanging station signs (S1/S2 blue sign & green header plate) */}
          <mesh position={[0.62, 1.98, -0.06]} scale={[0.28, 0.22, 0.02]} geometry={BOX_GEO} material={MAT_SRS_SIGN_BLUE} />
          <mesh position={[0.02, 1.96, -0.04]} scale={[0.48, 0.13, 0.018]} geometry={BOX_GEO} material={MAT_SRS_SIGN_GREEN} />

          {/* Overhead aluminum light bar & glowing LED tube */}
          {[-0.85, 0.85].map((bx) => (
            <mesh key={`arm-${bx}`} position={[bx, 1.88, -0.24]} scale={[0.05, 0.045, 0.48]} geometry={BOX_GEO} material={MAT_SRS_ALU} />
          ))}
          <mesh position={[0, 1.88, -0.44]} scale={[2.05, 0.05, 0.07]} geometry={BOX_GEO} material={MAT_SRS_ALU} />
          <mesh position={[0, 1.84, -0.44]} scale={[1.92, 0.035, 0.045]} geometry={BOX_GEO}>
            <meshStandardMaterial
              ref={beaconMatRef}
              color={callColor || "#f8fafc"}
              emissive={callColor || (running ? "#e0f2fe" : "#fef3c7")}
              emissiveIntensity={status === "off" ? 0.15 : 0.95}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* ── 6. Side 2-Tier Part-Stacking Stand (-X side, right of operator) ── */}
        <group position={[1.18, 0, -0.08]}>
          {/* White tubular frame legs */}
          {[-0.27, 0.27].flatMap((sx) =>
            [-0.42, 0.42].map((sz) => (
              <mesh key={`sleg-${sx}-${sz}`} position={[sx, 0.36, sz]} scale={[0.04, 0.72, 0.04]} geometry={BOX_GEO} material={MAT_SRS_WHITE_FRAME} />
            ))
          )}
          {/* Wooden top & middle shelves */}
          <mesh position={[0, 0.73, 0]} scale={[0.62, 0.04, 0.92]} geometry={BOX_GEO} material={MAT_SRS_WOOD} castShadow receiveShadow />
          <mesh position={[0, 0.41, 0]} scale={[0.58, 0.035, 0.88]} geometry={BOX_GEO} material={MAT_SRS_WOOD} receiveShadow />
          {/* Thick stack of dark-grey die-cut parts on top of side stand */}
          <mesh position={[0, 0.81, -0.18]} scale={[0.48, 0.12, 0.42]} geometry={BOX_GEO} material={MAT_SRS_PART} castShadow />
          <mesh position={[0, 0.875, -0.18]} scale={[0.16, 0.015, 0.1]} geometry={BOX_GEO} material={MAT_SRS_WOOD} />
          {/* White tray on back half of side stand */}
          <mesh position={[0, 0.765, 0.22]} scale={[0.46, 0.03, 0.32]} geometry={BOX_GEO} material={MAT_SRS_POSTER} />
        </group>
      </group>
    </group>
  );
});

/**
 * Static 3D decorative prop: Japanese Kensa (Inspection) Workbench (検査台).
 * Modeled after the green ESD inspection table with:
 *   - Light-grey square steel legs, leveling feet, and H-frame crossbar
 *   - Green ESD mat tabletop with black PVC edge banding
 *   - Upper riser frame with 3 power outlet sockets, middle cantilevered shelf,
 *     green magnetic backboard with 2 vertical white work-instruction sheets,
 *     and overhanging top canopy with underslung fluorescent LED tube light.
 * Oriented along the Z axis (width = size[1]), facing -X toward the AOL machines.
 */
export const KensaTable = memo(function KensaTable({ position, size = [1.3, 3.2] }) {
  const [d, w] = size;
  const halfW = w / 2;
  const halfD = d / 2;
  const legX = halfD - 0.08;
  const legZ = halfW - 0.08;
  const riserX = halfD - 0.12;

  return (
    <group position={[position[0], 0, position[1]]}>
      {/* ── 1. Lower Steel Frame & Legs ── */}
      {[-legX, legX].flatMap((lx) =>
        [-legZ, legZ].map((lz) => (
          <group key={`leg-${lx}-${lz}`} position={[lx, 0, lz]}>
            <mesh position={[0, 0.37, 0]} scale={[0.065, 0.72, 0.065]} geometry={BOX_GEO} material={MAT_KENSA_FRAME} castShadow receiveShadow />
            <mesh position={[0, 0.016, 0]} scale={[0.045, 0.032, 0.045]} geometry={CYL_GEO} material={MAT_KENSA_TRIM} />
          </group>
        ))
      )}
      {/* Under-table perimeter apron bars */}
      <mesh position={[-legX, 0.7, 0]} scale={[0.05, 0.05, w - 0.12]} geometry={BOX_GEO} material={MAT_KENSA_FRAME} />
      <mesh position={[legX, 0.7, 0]} scale={[0.05, 0.05, w - 0.12]} geometry={BOX_GEO} material={MAT_KENSA_FRAME} />
      {[-legZ, legZ].map((lz) => (
        <mesh key={`apron-${lz}`} position={[0, 0.7, lz]} scale={[d - 0.12, 0.05, 0.05]} geometry={BOX_GEO} material={MAT_KENSA_FRAME} />
      ))}
      {/* Lower H-frame side braces + long footrest crossbar */}
      {[-legZ, legZ].map((lz) => (
        <mesh key={`hbar-${lz}`} position={[0, 0.22, lz]} scale={[d - 0.14, 0.05, 0.05]} geometry={BOX_GEO} material={MAT_KENSA_FRAME} />
      ))}
      <mesh position={[0.08, 0.22, 0]} scale={[0.05, 0.05, w - 0.14]} geometry={BOX_GEO} material={MAT_KENSA_FRAME} />

      {/* ── 2. Green ESD Inspection Tabletop with Black PVC Edge Banding ── */}
      <mesh position={[0, 0.745, 0]} scale={[d, 0.042, w]} geometry={BOX_GEO} material={MAT_KENSA_TRIM} castShadow receiveShadow />
      <mesh position={[0, 0.768, 0]} scale={[d - 0.03, 0.012, w - 0.03]} geometry={BOX_GEO} material={MAT_KENSA_GREEN_MAT} receiveShadow />

      {/* ── 3. Upper Riser / Backboard Structure (at +X back edge, facing -X toward AOLs) ── */}
      {/* Rear vertical upright posts */}
      {[-legZ, legZ].map((lz) => (
        <mesh key={`up-${lz}`} position={[riserX, 1.2, lz]} scale={[0.065, 0.88, 0.065]} geometry={BOX_GEO} material={MAT_KENSA_FRAME} castShadow />
      ))}

      {/* Lower utility backboard panel (y = 0.77..1.05) with 3 white power outlet sockets */}
      <mesh position={[riserX, 0.91, 0]} scale={[0.04, 0.28, w - 0.16]} geometry={BOX_GEO} material={MAT_KENSA_FRAME} receiveShadow />
      {[-w * 0.27, 0, w * 0.27].map((oz) => (
        <group key={`sock-${oz}`} position={[riserX - 0.028, 0.91, oz]}>
          <mesh scale={[0.022, 0.1, 0.16]} geometry={BOX_GEO} material={MAT_SRS_POSTER} />
          <mesh position={[-0.012, 0, -0.03]} scale={[0.005, 0.03, 0.03]} geometry={BOX_GEO} material={MAT_KENSA_TRIM} />
          <mesh position={[-0.012, 0, 0.03]} scale={[0.005, 0.03, 0.03]} geometry={BOX_GEO} material={MAT_KENSA_TRIM} />
        </group>
      ))}

      {/* Middle cantilevered utility shelf (y = 1.06) */}
      <mesh position={[riserX - 0.16, 1.06, 0]} scale={[0.38, 0.034, w - 0.02]} geometry={BOX_GEO} material={MAT_KENSA_TRIM} castShadow receiveShadow />
      <mesh position={[riserX - 0.16, 1.079, 0]} scale={[0.35, 0.008, w - 0.05]} geometry={BOX_GEO} material={MAT_KENSA_SHELF} receiveShadow />

      {/* Green magnetic/pin backboard (y = 1.09..1.56) with 2 vertical white A4 instruction sheets (both faces) */}
      <mesh position={[riserX, 1.325, 0]} scale={[0.036, 0.44, w - 0.16]} geometry={BOX_GEO} material={MAT_KENSA_GREEN_BOARD} castShadow receiveShadow />
      {[-0.022, 0.022].flatMap((faceX) =>
        [-w * 0.15, w * 0.15].map((pz) => (
          <group key={`doc-${faceX}-${pz}`} position={[riserX + faceX, 1.325, pz]}>
            <mesh scale={[0.006, 0.36, 0.3]} geometry={BOX_GEO} material={MAT_SRS_POSTER} />
            <mesh position={[faceX > 0 ? 0.004 : -0.004, 0.12, 0]} scale={[0.003, 0.04, 0.22]} geometry={BOX_GEO} material={MAT_SRS_ALU} />
            <mesh position={[faceX > 0 ? 0.004 : -0.004, -0.02, 0]} scale={[0.003, 0.16, 0.2]} geometry={BOX_GEO} material={MAT_SRS_ALU} />
          </group>
        ))
      )}

      {/* Top overhanging light canopy (y = 1.60) + underslung glowing LED fluorescent tube */}
      <mesh position={[riserX - 0.18, 1.6, 0]} scale={[0.44, 0.045, w]} geometry={BOX_GEO} material={MAT_KENSA_TRIM} castShadow />
      <mesh position={[riserX - 0.18, 1.624, 0]} scale={[0.41, 0.008, w - 0.03]} geometry={BOX_GEO} material={MAT_KENSA_FRAME} />
      <mesh position={[riserX - 0.26, 1.56, 0]} scale={[0.045, 0.032, w * 0.78]} geometry={BOX_GEO} material={MAT_KENSA_LIGHT} />
    </group>
  );
});

