import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import StatusGlow from "./StatusGlow";
import { phaseFor, useCycleFlash } from "./twinHooks";
import { NC_DEPTH, ncLengthFor } from "../../data/factoryLayouts/kose";

const COLORS = {
  frame: "#e9edf2",
  base: "#3b4048",
  carriage: "#2f343b",
  beam: "#d5dae1",
  rail: "#25292f",
  table: "#e7d2b5",
  conveyor: "#86cf9a",
  slat: "#5ea874",
  head: "#f4f6f8",
  cap: "#f08a4b",
  tube: "#1f2328",
  light: "#ff7a2f",
};

function Tube({ from, to, radius = 0.022 }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz);
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
  // Orient cylinder (default along Y) toward the segment direction
  const rotation = dx !== 0 ? [0, 0, Math.PI / 2] : dz !== 0 ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  return (
    <mesh position={mid} rotation={rotation} castShadow>
      <cylinderGeometry args={[radius, radius, length, 10]} />
      <meshStandardMaterial color={COLORS.tube} roughness={0.5} metalness={0.4} />
    </mesh>
  );
}

/**
 * Low-poly model of the 小瀬 NC flatbed cutting machine:
 * white/charcoal body, beige cutting bed, green conveyor feed, charcoal gantry with
 * orange indicator lights, 1–2 white cutting heads, black tubular safety rails and a
 * control pedestal. The gantry and heads move while the machine is running.
 */
export default function NcCutter({ id, position, noOfHead = 1, tableLength = 1200, status, selected, cycle, call, onSelect }) {
  const L = ncLengthFor(tableLength);
  const D = NC_DEPTH;
  const heads = Math.max(1, Math.min(2, Number(noOfHead) || 1));
  const running = status === "running";
  const phase = phaseFor(id);

  const groupRef = useRef();
  const gantryRef = useRef();
  const headsRef = useRef();
  const frameMatRef = useRef();
  const lightMats = useRef([]);
  const tipRef = useRef();
  const [hovered, setHovered] = useState(false);
  const flashRef = useCycleFlash(cycle);

  const gantryRestX = L * 0.05;
  const callColor = call?.leader
    ? "#ef4444"
    : call?.stop
      ? "#a855f7"
      : call?.box
        ? "#f59e0b"
        : call?.material
          ? "#3b82f6"
          : null;

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const k = Math.min(1, delta * 4);
    if (gantryRef.current) {
      const targetX = running ? gantryRestX + Math.sin(t * 0.7 + phase) * L * 0.27 : gantryRestX;
      gantryRef.current.position.x += (targetX - gantryRef.current.position.x) * k;
    }
    if (headsRef.current) {
      const targetZ = running ? Math.sin(t * 1.6 + phase) * D * 0.2 : 0;
      headsRef.current.position.z += (targetZ - headsRef.current.position.z) * k;
    }
    if (groupRef.current) {
      const lift = hovered || selected ? 0.06 : 0;
      groupRef.current.position.y += (lift - groupRef.current.position.y) * k;
    }
    if (frameMatRef.current) {
      if (callColor) {
        const pulse = (Math.sin(t * (call?.leader ? 8 : 4.5)) + 1) * 0.5;
        frameMatRef.current.emissive.set(callColor);
        frameMatRef.current.emissiveIntensity = 0.18 + pulse * (call?.leader ? 0.65 : 0.35);
      } else {
        frameMatRef.current.emissiveIntensity = 0;
      }
    }
    const lightIntensity = callColor
      ? 2.8 + Math.sin(t * 9) * 1.6
      : running
        ? 2.2 + Math.sin(t * 6 + phase) * 0.6
        : status === "off"
          ? 0.1
          : 0.8;
    lightMats.current.forEach((m) => {
      if (m) {
        m.emissiveIntensity = lightIntensity;
      }
    });
    if (tipRef.current) {
      const age = flashRef.current ? t - flashRef.current : Infinity;
      const s = age < 0.8 ? 1 + (1 - age / 0.8) * 2.5 : running ? 1 : 0.001;
      tipRef.current.scale.setScalar(s);
    }
  });

  const handlePointer = (over) => (e) => {
    e.stopPropagation();
    setHovered(over);
    document.body.style.cursor = over ? "pointer" : "";
  };

  const headOffsets = heads === 2 ? [-0.11, 0.11] : [0];
  const slats = [-0.3, -0.1, 0.1, 0.3];
  const effectiveGlowStatus = call?.leader || call?.stop ? "stopCall" : status;

  return (
    <group position={[position[0], 0, position[1]]}>
      <StatusGlow width={L + 0.5} depth={D} status={effectiveGlowStatus} selected={selected} flashRef={flashRef} />

      <group
        ref={groupRef}
        onClick={(e) => { e.stopPropagation(); onSelect?.(id); }}
        onPointerOver={handlePointer(true)}
        onPointerOut={handlePointer(false)}
      >
        {/* Body */}
        <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
          <boxGeometry args={[L * 0.96, 0.34, D * 0.94]} />
          <meshStandardMaterial color={COLORS.base} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.385, 0]} castShadow receiveShadow>
          <boxGeometry args={[L, 0.09, D]} />
          <meshStandardMaterial ref={frameMatRef} color={COLORS.frame} roughness={0.45} />
        </mesh>

        {/* Cutting bed + conveyor feed */}
        <mesh position={[L * 0.1, 0.44, 0]} receiveShadow>
          <boxGeometry args={[L * 0.74, 0.03, D * 0.84]} />
          <meshStandardMaterial color={COLORS.table} roughness={0.9} />
        </mesh>
        <mesh position={[-L * 0.4, 0.44, 0]} receiveShadow>
          <boxGeometry args={[L * 0.16, 0.03, D * 0.84]} />
          <meshStandardMaterial color={COLORS.conveyor} roughness={0.8} />
        </mesh>
        {slats.map((f) => (
          <mesh key={f} position={[-L * 0.4 + f * L * 0.16, 0.457, 0]}>
            <boxGeometry args={[0.012, 0.006, D * 0.84]} />
            <meshStandardMaterial color={COLORS.slat} />
          </mesh>
        ))}

        {/* Gantry */}
        <group ref={gantryRef} position={[gantryRestX, 0, 0]}>
          {[-1, 1].map((side) => (
            <group key={side} position={[0, 0.63, side * (D / 2 + 0.05)]}>
              <RoundedBox args={[0.28, 0.44, 0.2]} radius={0.04} smoothness={3} castShadow>
                <meshStandardMaterial color={COLORS.carriage} roughness={0.5} />
              </RoundedBox>
              <mesh position={[0, 0.08, side * 0.102]}>
                <boxGeometry args={[0.1, 0.03, 0.005]} />
                <meshStandardMaterial
                  ref={(m) => { lightMats.current[side > 0 ? 1 : 0] = m; }}
                  color={callColor || COLORS.light}
                  emissive={callColor || COLORS.light}
                  emissiveIntensity={1}
                  toneMapped={false}
                />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.76, 0]} castShadow>
            <boxGeometry args={[0.17, 0.13, D + 0.14]} />
            <meshStandardMaterial color={COLORS.beam} roughness={0.35} metalness={0.3} />
          </mesh>
          <mesh position={[-0.1, 0.71, 0]}>
            <boxGeometry args={[0.04, 0.04, D + 0.02]} />
            <meshStandardMaterial color={COLORS.rail} />
          </mesh>

          {/* Cutting heads */}
          <group ref={headsRef}>
            {headOffsets.map((z) => (
              <group key={z} position={[-0.15, 0, z]}>
                <mesh position={[0, 0.62, 0]} castShadow>
                  <boxGeometry args={[0.1, 0.3, 0.12]} />
                  <meshStandardMaterial color={COLORS.head} roughness={0.4} />
                </mesh>
                <mesh position={[0, 0.8, 0]} castShadow>
                  <boxGeometry args={[0.11, 0.07, 0.13]} />
                  <meshStandardMaterial color={COLORS.cap} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0.47, 0]}>
                  <cylinderGeometry args={[0.012, 0.02, 0.05, 8]} />
                  <meshStandardMaterial color="#9aa3ad" metalness={0.7} roughness={0.3} />
                </mesh>
              </group>
            ))}
            <mesh ref={tipRef} position={[-0.15, 0.455, 0]}>
              <sphereGeometry args={[0.025, 10, 10]} />
              <meshBasicMaterial color="#ffb26b" toneMapped={false} />
            </mesh>
          </group>
        </group>

        {/* Back safety frame */}
        <Tube from={[L / 2 + 0.08, 0, -D / 2 - 0.06]} to={[L / 2 + 0.08, 1.0, -D / 2 - 0.06]} />
        <Tube from={[L / 2 + 0.08, 0, D / 2 + 0.06]} to={[L / 2 + 0.08, 1.0, D / 2 + 0.06]} />
        <Tube from={[L / 2 + 0.08, 1.0, -D / 2 - 0.06]} to={[L / 2 + 0.08, 1.0, D / 2 + 0.06]} />
        <Tube from={[L / 2 + 0.08, 0.55, -D / 2 - 0.06]} to={[L / 2 + 0.08, 0.55, D / 2 + 0.06]} radius={0.015} />
        {/* Front rail */}
        <Tube from={[-L / 2 - 0.04, 0, -D / 2 + 0.05]} to={[-L / 2 - 0.04, 0.56, -D / 2 + 0.05]} radius={0.018} />
        <Tube from={[-L / 2 - 0.04, 0, D / 2 - 0.05]} to={[-L / 2 - 0.04, 0.56, D / 2 - 0.05]} radius={0.018} />
        <Tube from={[-L / 2 - 0.04, 0.56, -D / 2 + 0.05]} to={[-L / 2 - 0.04, 0.56, D / 2 - 0.05]} radius={0.018} />

        {/* Control pedestal */}
        <group position={[-L / 2 - 0.3, 0, D / 2 - 0.22]}>
          <RoundedBox args={[0.3, 0.56, 0.3]} radius={0.03} smoothness={3} position={[0, 0.28, 0]} castShadow>
            <meshStandardMaterial color={COLORS.base} roughness={0.6} />
          </RoundedBox>
          <RoundedBox args={[0.38, 0.1, 0.36]} radius={0.03} smoothness={3} position={[0, 0.61, 0]} castShadow>
            <meshStandardMaterial color={COLORS.frame} roughness={0.4} />
          </RoundedBox>
          <mesh position={[0.02, 0.665, 0.03]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.2, 0.13]} />
            <meshStandardMaterial color="#1e293b" emissive="#38bdf8" emissiveIntensity={status === "off" ? 0.05 : 0.5} />
          </mesh>
          <mesh position={[-0.12, 0.68, -0.12]}>
            <cylinderGeometry args={[0.025, 0.025, 0.04, 12]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.4} />
          </mesh>
          {[-0.04, 0.04].map((z) => (
            <mesh key={z} position={[0.13, 0.72, z - 0.1]}>
              <cylinderGeometry args={[0.018, 0.018, 0.12, 8]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
