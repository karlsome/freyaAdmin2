import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getGlowTexture } from "./twinTextures";
import { CALL_THEMES, getPrimaryCallType } from "../../hooks/useFactoryCallMonitor";

/**
 * 3D Emergency Siren / Beacon for Leader Call (`leader`) or Stop Queued (`stop`)
 */
function SirenBeacon3D({ color = "#e11d2a", offset = [0, 0, 0] }) {
  const groupRef = useRef();
  const beamRef = useRef();
  const domeMatRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.y = offset[1] + Math.sin(t * 4.5) * 0.09;
    }
    if (beamRef.current) {
      beamRef.current.rotation.y = t * 5.5;
    }
    if (domeMatRef.current) {
      domeMatRef.current.emissiveIntensity = 1.8 + Math.sin(t * 10) * 0.9;
    }
  });

  return (
    <group ref={groupRef} position={offset}>
      {/* Siren base */}
      <mesh position={[0, -0.14, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.08, 20]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Glowing siren dome */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.26, 20]} />
        <meshStandardMaterial
          ref={domeMatRef}
          color={color}
          emissive={color}
          emissiveIntensity={2.2}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.16, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.2}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>

      {/* Rotating dual light beams */}
      <group ref={beamRef} position={[0, 0.05, 0]}>
        <mesh position={[0.38, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.22, 0.65, 16, 1, true]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[-0.38, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.22, 0.65, 16, 1, true]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * 3D Floating & Bouncing Cardboard Box Animation for Box Request (`box`)
 */
function CardboardBox3D({ offset = [0, 0, 0] }) {
  const groupRef = useRef();
  const ringRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      // Smooth bounce + gentle spin
      const bounce = Math.abs(Math.sin(t * 3.2)) * 0.22;
      groupRef.current.position.y = offset[1] + bounce;
      groupRef.current.rotation.y = t * 1.35;
      groupRef.current.rotation.z = Math.sin(t * 3.2) * 0.08;
    }
    if (ringRef.current) {
      const s = 0.85 + Math.sin(t * 3.2) * 0.15;
      ringRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group position={[offset[0], 0, offset[2]]}>
      <group ref={groupRef} position={[0, offset[1], 0]}>
        {/* Main cardboard box body */}
        <mesh castShadow>
          <boxGeometry args={[0.52, 0.42, 0.44]} />
          <meshStandardMaterial
            color="#d99b66"
            emissive="#f59e0b"
            emissiveIntensity={0.28}
            roughness={0.75}
          />
        </mesh>

        {/* Dark interior top face to give open-box depth */}
        <mesh position={[0, 0.212, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.46, 0.38]} />
          <meshBasicMaterial color="#6b4423" />
        </mesh>

        {/* Amber/yellow shipping tape & label stripes on front/back */}
        <mesh position={[0, 0, 0.223]}>
          <planeGeometry args={[0.16, 0.42]} />
          <meshBasicMaterial color="#fbbf24" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.223]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.16, 0.42]} />
          <meshBasicMaterial color="#fbbf24" toneMapped={false} />
        </mesh>

        {/* 4 Open Cardboard Flaps */}
        {/* Front flap */}
        <mesh position={[0, 0.25, 0.27]} rotation={[0.55, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.025, 0.18]} />
          <meshStandardMaterial color="#e4ae7c" emissive="#f59e0b" emissiveIntensity={0.2} roughness={0.7} />
        </mesh>
        {/* Back flap */}
        <mesh position={[0, 0.25, -0.27]} rotation={[-0.55, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.025, 0.18]} />
          <meshStandardMaterial color="#e4ae7c" emissive="#f59e0b" emissiveIntensity={0.2} roughness={0.7} />
        </mesh>
        {/* Left flap */}
        <mesh position={[-0.3, 0.24, 0]} rotation={[0, 0, 0.55]} castShadow>
          <boxGeometry args={[0.16, 0.025, 0.42]} />
          <meshStandardMaterial color="#cfa06e" emissive="#f59e0b" emissiveIntensity={0.2} roughness={0.7} />
        </mesh>
        {/* Right flap */}
        <mesh position={[0.3, 0.24, 0]} rotation={[0, 0, -0.55]} castShadow>
          <boxGeometry args={[0.16, 0.025, 0.42]} />
          <meshStandardMaterial color="#cfa06e" emissive="#f59e0b" emissiveIntensity={0.2} roughness={0.7} />
        </mesh>
      </group>

      {/* Floating amber ring halo beneath the bouncing box */}
      <mesh ref={ringRef} position={[0, offset[1] - 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.42, 28]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * 3D Floating & Rolling Material Roll Animation for Material Request (`material`)
 */
function MaterialRoll3D({ offset = [0, 0, 0] }) {
  const groupRef = useRef();
  const rollRef = useRef();
  const ringRef = useRef();

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.y = offset[1] + Math.sin(t * 2.8 + 1) * 0.12;
      groupRef.current.rotation.y = Math.sin(t * 1.1) * 0.35;
    }
    if (rollRef.current) {
      rollRef.current.rotation.x += delta * 2.6;
    }
    if (ringRef.current) {
      const s = 0.9 + Math.sin(t * 3.0) * 0.12;
      ringRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group position={[offset[0], 0, offset[2]]}>
      <group ref={groupRef} position={[0, offset[1], 0]}>
        <group ref={rollRef}>
          {/* Main white/cream material roll cylinder (oriented horizontally along X) */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.62, 24]} />
            <meshStandardMaterial
              color="#f8fafc"
              emissive="#3b82f6"
              emissiveIntensity={0.35}
              roughness={0.45}
            />
          </mesh>

          {/* Inner cardboard core protruding slightly from both ends */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.085, 0.085, 0.68, 16]} />
            <meshStandardMaterial color="#92400e" roughness={0.8} />
          </mesh>

          {/* Blue roll indicator stripes around the cylinder so spinning motion is obvious */}
          {[-0.18, 0, 0.18].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.242, 0.014, 8, 24]} />
              <meshBasicMaterial color="#60a5fa" toneMapped={false} />
            </mesh>
          ))}

          {/* Unrolling sheet flap */}
          <mesh position={[0, -0.2, 0.18]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.58, 0.02, 0.24]} />
            <meshStandardMaterial
              color="#e2e8f0"
              emissive="#3b82f6"
              emissiveIntensity={0.25}
              roughness={0.5}
            />
          </mesh>
        </group>
      </group>

      {/* Floating blue ring halo beneath the material roll */}
      <mesh ref={ringRef} position={[0, offset[1] - 0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.44, 28]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

import { memo } from "react";

/**
 * Renders the 3D floor shockwaves, vertical light column, and floating 3D call objects
 * (Siren for Leader/Stop, Bouncing Box for Box Request, Rolling Cylinder for Material Request)
 * for any calling machine on the factory floor.
 */
const MachineCallEffect = memo(function MachineCallEffect({
  call,
  position,
  width = 3.0,
  depth = 1.3,
  baseHeight = 1.65,
}) {
  const ring1Ref = useRef();
  const ring2Ref = useRef();
  const floorGlowRef = useRef();
  const pillarRef = useRef();
  const glowTex = useMemo(() => getGlowTexture(), []);

  const primaryType = getPrimaryCallType(call) || "leader";
  const theme = CALL_THEMES[primaryType] || CALL_THEMES.leader;
  const isUrgent = Boolean(call?.leader || call?.stop);

  // Determine which 3D floating objects to display above the machine
  const activeModels = useMemo(() => {
    if (!call) return [];
    const list = [];
    if (call.leader) list.push({ type: "leader", color: CALL_THEMES.leader.color });
    else if (call.stop) list.push({ type: "stop", color: CALL_THEMES.stop.color });
    if (call.box) list.push({ type: "box", color: CALL_THEMES.box.color });
    if (call.material) list.push({ type: "material", color: CALL_THEMES.material.color });
    return list;
  }, [call]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const speed = isUrgent ? 1.35 : 0.9;

    if (ring1Ref.current) {
      const p1 = (t * speed) % 1;
      const s1 = 0.95 + p1 * 0.75;
      ring1Ref.current.scale.set(s1, s1, 1);
      ring1Ref.current.material.opacity = (1 - p1) * (isUrgent ? 0.9 : 0.7);
    }

    if (ring2Ref.current) {
      const p2 = (t * speed + 0.5) % 1;
      const s2 = 0.95 + p2 * 0.75;
      ring2Ref.current.scale.set(s2, s2, 1);
      ring2Ref.current.material.opacity = (1 - p2) * (isUrgent ? 0.85 : 0.6);
    }

    if (floorGlowRef.current) {
      const pulse = 0.55 + Math.sin(t * (isUrgent ? 7 : 4)) * 0.3;
      floorGlowRef.current.material.opacity = pulse;
    }

    if (pillarRef.current) {
      pillarRef.current.material.opacity = 0.14 + Math.sin(t * 6) * 0.08;
    }
  });

  if (!call) return null;

  const radius = Math.max(width, depth) * 0.62;
  const spacing = 0.78;
  const startX = -((activeModels.length - 1) * spacing) / 2;

  return (
    <group position={[position[0], 0, position[1]]}>
      {/* Intense pulsing floor aura under the machine */}
      <mesh
        ref={floorGlowRef}
        position={[0, 0.022, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={3}
      >
        <planeGeometry args={[width * 1.75, depth * 2.25]} />
        <meshBasicMaterial
          map={glowTex}
          color={theme.glow}
          transparent
          opacity={0.75}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Expanding Floor Shockwave Ring 1 */}
      <mesh
        ref={ring1Ref}
        position={[0, 0.028, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={4}
      >
        <ringGeometry args={[radius * 0.88, radius, 40]} />
        <meshBasicMaterial
          color={theme.glow}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Expanding Floor Shockwave Ring 2 (staggered by 0.5 phase) */}
      <mesh
        ref={ring2Ref}
        position={[0, 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={4}
      >
        <ringGeometry args={[radius * 0.88, radius, 40]} />
        <meshBasicMaterial
          color={theme.glow}
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Vertical light beacon column for Leader Call / Stop Queued */}
      {isUrgent && (
        <mesh ref={pillarRef} position={[0, 1.4, 0]} renderOrder={2}>
          <cylinderGeometry args={[radius * 0.55, radius * 0.85, 2.8, 24, 1, true]} />
          <meshBasicMaterial
            color={theme.glow}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Floating 3D Animated Call Objects */}
      {activeModels.map((item, idx) => {
        const xOffset = startX + idx * spacing;
        const posOffset = [xOffset, baseHeight, 0];
        if (item.type === "leader" || item.type === "stop") {
          return <SirenBeacon3D key={item.type} color={item.color} offset={posOffset} />;
        }
        if (item.type === "box") {
          return <CardboardBox3D key="box" offset={posOffset} />;
        }
        if (item.type === "material") {
          return <MaterialRoll3D key="material" offset={posOffset} />;
        }
        return null;
      })}
    </group>
  );
});

export default MachineCallEffect;

