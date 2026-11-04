import { memo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import StatusGlow from "./StatusGlow";
import { useCycleFlash } from "./twinHooks";

const COLORS = {
  body: "#c9cdd2",
  skirt: "#8d939a",
  fence: "#facc15",
  fenceEdge: "#eab308",
  bedFrame: "#d4d8dc",
  bed: "#dc2626",
  stripe: "#991b1b",
  glass: "#1e293b",
  hydraulic: "#f1f5f9",
  hose: "#111827",
};

/**
 * Low-poly model of OZMANAS: large grey press body with yellow mesh safety fence,
 * red material bed extending out the front, side control box and hydraulic unit.
 * Bed stripes scroll while running.
 */
const ManasMachine = memo(function ManasMachine({ id, position, size, modelScale = 1, status, selected, cycle, call, onSelect }) {
  const [w, d] = size;
  const running = status === "running";
  const groupRef = useRef();
  const bodyMatRef = useRef();
  const stripesRef = useRef();
  const [hovered, setHovered] = useState(false);
  const flashRef = useCycleFlash(cycle);

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
    const targetLift = hovered || selected ? 0.06 : 0;
    const grpY = groupRef.current ? Math.abs(groupRef.current.position.y - targetLift) : 0;

    if (!running && !callColor && grpY < 0.001) {
      if (bodyMatRef.current && bodyMatRef.current.emissiveIntensity !== 0) {
        bodyMatRef.current.emissiveIntensity = 0;
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
        bodyMatRef.current.emissiveIntensity = 0.16 + pulse * (call?.leader ? 0.6 : 0.32);
      } else if (bodyMatRef.current.emissiveIntensity !== 0) {
        bodyMatRef.current.emissiveIntensity = 0;
      }
    }
    if (stripesRef.current && running) {
      stripesRef.current.children.forEach((child, i) => {
        const base = (t * 0.35 + i / 3) % 1;
        child.position.x = -2.4 + base * 2.1;
      });
    }
  });

  const handlePointer = (over) => (e) => {
    e.stopPropagation();
    setHovered(over);
    document.body.style.cursor = over ? "pointer" : "";
  };

  const fencePosts = [
    [-0.2, -1.8], [-0.2, 0], [-0.2, 1.8],
    [2.2, -1.8], [2.2, 0], [2.2, 1.8],
    [1.0, -1.8], [1.0, 1.8],
  ];
  const effectiveGlowStatus = call?.leader || call?.stop ? "stopCall" : status;

  return (
    <group position={[position[0], 0, position[1]]}>
      <StatusGlow width={w * 0.95} depth={d * 0.62} status={effectiveGlowStatus} selected={selected} flashRef={flashRef} />

      <group
        ref={groupRef}
        scale={modelScale}
        onClick={(e) => { e.stopPropagation(); onSelect?.(id); }}
        onPointerOver={handlePointer(true)}
        onPointerOut={handlePointer(false)}
      >
        {/* Main press body */}
        <mesh position={[1.0, 0.075, 0]} receiveShadow>
          <boxGeometry args={[2.5, 0.15, 3.7]} />
          <meshStandardMaterial color={COLORS.skirt} roughness={0.8} />
        </mesh>
        <mesh position={[1.0, 0.72, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 1.3, 3.6]} />
          <meshStandardMaterial ref={bodyMatRef} color={COLORS.body} roughness={0.55} metalness={0.15} />
        </mesh>
        <mesh position={[0.55, 0.78, 1.805]}>
          <planeGeometry args={[0.55, 0.32]} />
          <meshStandardMaterial color={COLORS.glass} roughness={0.2} metalness={0.5} />
        </mesh>

        {/* Yellow safety fence */}
        <mesh position={[1.0, 1.85, 0]}>
          <boxGeometry args={[2.4, 0.95, 3.6]} />
          <meshStandardMaterial color={COLORS.fence} transparent opacity={0.16} depthWrite={false} />
          <Edges color={COLORS.fenceEdge} />
        </mesh>
        {fencePosts.map(([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, 1.85, z]}>
            <boxGeometry args={[0.06, 0.95, 0.06]} />
            <meshStandardMaterial color={COLORS.fence} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[1.0, 1.85, 1.8]}>
          <boxGeometry args={[2.4, 0.03, 0.03]} />
          <meshStandardMaterial color={COLORS.fence} />
        </mesh>
        <mesh position={[1.0, 1.85, -1.8]}>
          <boxGeometry args={[2.4, 0.03, 0.03]} />
          <meshStandardMaterial color={COLORS.fence} />
        </mesh>
        {/* Overhead aluminium truss */}
        {[-1.1, 1.1].map((z) => (
          <mesh key={z} position={[1.0, 2.42, z]}>
            <boxGeometry args={[2.6, 0.08, 0.1]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.3} />
          </mesh>
        ))}

        {/* Red material bed */}
        <mesh position={[-1.35, 0.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.3, 0.6, 3.2]} />
          <meshStandardMaterial color={COLORS.bedFrame} roughness={0.6} />
        </mesh>
        <mesh position={[-1.35, 0.76, 0]} receiveShadow>
          <boxGeometry args={[2.3, 0.08, 3.0]} />
          <meshStandardMaterial color={COLORS.bed} roughness={0.45} />
        </mesh>
        <group ref={stripesRef} position={[0, 0.805, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[-2.4 + (i / 3) * 2.1, 0, 0]}>
              <boxGeometry args={[0.05, 0.006, 3.0]} />
              <meshStandardMaterial color={COLORS.stripe} />
            </mesh>
          ))}
        </group>
        <mesh position={[-2.5, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 3.1, 12]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.5} roughness={0.3} />
        </mesh>

        {/* Control box */}
        <mesh position={[-0.15, 0.95, 1.9]}>
          <boxGeometry args={[0.45, 0.55, 0.22]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.5} />
        </mesh>
        <mesh position={[-0.15, 0.98, 2.012]}>
          <planeGeometry args={[0.22, 0.2]} />
          <meshStandardMaterial color={COLORS.glass} emissive="#f59e0b" emissiveIntensity={status === "off" ? 0 : 0.35} />
        </mesh>

        {/* Hydraulic unit */}
        <mesh position={[2.15, 0.32, -2.2]}>
          <boxGeometry args={[0.8, 0.6, 0.7]} />
          <meshStandardMaterial color={COLORS.hydraulic} roughness={0.5} />
        </mesh>
        <mesh position={[1.9, 0.82, -2.2]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.18, 0.03, 6, 12, Math.PI * 1.4]} />
          <meshStandardMaterial color={COLORS.hose} roughness={0.6} />
        </mesh>
        <mesh position={[2.3, 0.8, -2.2]} rotation={[0, Math.PI / 2, 0.6]}>
          <torusGeometry args={[0.14, 0.025, 6, 12, Math.PI * 1.2]} />
          <meshStandardMaterial color={COLORS.hose} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
});

export default ManasMachine;
