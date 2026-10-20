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
const MAT_WEB_SRS = new THREE.MeshStandardMaterial({ color: "#a7f3d0", roughness: 0.45 });
const MAT_SRS_STRIPE = new THREE.MeshStandardMaterial({ color: "#10b981", roughness: 0.4 });
const MAT_SCREEN_ON = new THREE.MeshStandardMaterial({ color: "#0f172a", emissive: "#38bdf8", emissiveIntensity: 0.55 });
const MAT_SCREEN_OFF = new THREE.MeshStandardMaterial({ color: "#0f172a", emissive: "#38bdf8", emissiveIntensity: 0.05 });

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

/**
 * 3D model for SRS 1 & SRS 2: compact slitting / rewinding & inspection station.
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
  const stripesRef = useRef();
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
          ? 2.0 + Math.sin(t * 5.5 + phase) * 0.5
          : status === "off"
            ? 0.1
            : 0.7;
    }
    if (running && stripesRef.current) {
      stripesRef.current.children.forEach((child, i) => {
        const prog = (t * 0.48 + i / 3 + phase) % 1;
        child.position.z = -0.65 + prog * 1.3;
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
        {/* Main chassis */}
        <mesh position={[0, 0.18, 0]} scale={[w * 0.82, 0.36, d * 0.78]} geometry={BOX_GEO} material={MAT_BASE} castShadow receiveShadow />
        <mesh position={[0, 0.52, 0]} scale={[w * 0.78, 0.36, d * 0.72]} geometry={BOX_GEO} receiveShadow>
          <meshStandardMaterial ref={bodyMatRef} color="#e2e8f0" roughness={0.45} metalness={0.12} />
        </mesh>

        {/* Overhead slitter/inspection arch */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * (w * 0.34), 0.96, -0.05]}
            scale={[0.16, 0.56, 0.38]}
            geometry={BOX_GEO}
            material={MAT_DARK_METAL}
          />
        ))}
        <mesh position={[0, 1.22, -0.05]} scale={[w * 0.76, 0.16, 0.42]} geometry={BOX_GEO} material={MAT_FRAME} castShadow />

        {/* Status tower light on arch */}
        <mesh position={[w * 0.28, 1.42, -0.05]} scale={[0.06, 0.24, 0.06]} geometry={CYL_GEO}>
          <meshStandardMaterial
            ref={beaconMatRef}
            color={callColor || (running ? "#22c55e" : "#f59e0b")}
            emissive={callColor || (running ? "#22c55e" : "#f59e0b")}
            emissiveIntensity={status === "off" ? 0.1 : 1.1}
            toneMapped={false}
          />
        </mesh>

        {/* Inspection web bed + animated slitting lines */}
        <mesh position={[0, 0.71, 0]} scale={[w * 0.58, 0.02, d * 0.58]} geometry={BOX_GEO} material={MAT_WEB_SRS} />
        <group ref={stripesRef} position={[0, 0.725, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0, -0.65 + (i / 3) * 1.3]} scale={[w * 0.55, 0.008, 0.06]} geometry={BOX_GEO} material={MAT_SRS_STRIPE} />
          ))}
        </group>

        {/* Back unwind roll & front rewind roll */}
        {[-0.68, 0.68].map((rz, idx) => (
          <group key={rz} position={[0, 0.78, rz]} rotation={[0, 0, Math.PI / 2]}>
            <mesh scale={[idx === 0 ? 0.26 : 0.22, w * 0.56, idx === 0 ? 0.26 : 0.22]} geometry={CYL_GEO} material={MAT_ROLL_RAW} castShadow />
            <mesh scale={[0.09, w * 0.64, 0.09]} geometry={CYL_GEO} material={MAT_ROLL_CORE} />
          </group>
        ))}

        {/* Side Control Console */}
        <group position={[w * 0.43, 0, 0.35]}>
          <mesh position={[0, 0.45, 0]} scale={[0.24, 0.9, 0.36]} geometry={BOX_GEO} material={MAT_DARK_METAL} />
          <mesh
            position={[0, 0.72, 0.185]}
            scale={[0.18, 0.18, 0.01]}
            geometry={BOX_GEO}
            material={status === "off" ? MAT_SCREEN_OFF : MAT_SCREEN_ON}
          />
        </group>
      </group>
    </group>
  );
});

