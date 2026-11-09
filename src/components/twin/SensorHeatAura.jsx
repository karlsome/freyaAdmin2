import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getRadialHeatTexture, getHeatRingTexture } from "./twinTextures";

const AURA_COLORS = {
  extreme: "#dc2626", // Deep crimson red
  danger:  "#ef4444", // Vivid alert red (Unsafe for human workers)
  warning: "#f59e0b", // Warm amber (Caution)
  normal:  "#10b981", // Calming emerald green (Safe & comfortable)
};

const UNIT_PLANE_GEO = new THREE.PlaneGeometry(1, 1);

/**
 * 3D Ambient Heat Aura emitted on the factory floor around a temperature sensor.
 * Emits red and pulses rapidly if the area exceeds safe worker thermal thresholds.
 */
const SensorHeatAura = memo(function SensorHeatAura({ radius = 3.0, status = "normal", isDanger = false }) {
  const glowRef = useRef();
  const ringRef = useRef();
  const heatTex = useMemo(() => getRadialHeatTexture(), []);
  const ringTex = useMemo(() => getHeatRingTexture(), []);

  const color = AURA_COLORS[status] || AURA_COLORS.normal;
  const baseDiameter = radius * 2;

  useFrame(({ clock }) => {
    if (!isDanger && status !== "warning") {
      if (glowRef.current && glowRef.current.material.opacity !== 0.38) {
        glowRef.current.material.opacity = 0.38;
        glowRef.current.scale.set(baseDiameter, baseDiameter, 1);
      }
      return;
    }

    const t = clock.getElapsedTime();

    if (glowRef.current) {
      if (isDanger) {
        // Fast, noticeable warning pulsation (1.5 Hz)
        const breathe = 0.25 * Math.sin(t * 5.0);
        glowRef.current.material.opacity = THREE.MathUtils.clamp(0.65 + breathe, 0.35, 0.95);
        const s = baseDiameter * (1.0 + 0.08 * Math.sin(t * 5.0));
        glowRef.current.scale.set(s, s, 1);
      } else if (status === "warning") {
        // Mild, slow breathing for elevated warmth (0.6 Hz)
        const breathe = 0.12 * Math.sin(t * 2.5);
        glowRef.current.material.opacity = THREE.MathUtils.clamp(0.48 + breathe, 0.3, 0.65);
        glowRef.current.scale.set(baseDiameter, baseDiameter, 1);
      }
    }

    if (ringRef.current && isDanger) {
      // Expanding alert wave radiating outwards
      const wavePhase = (t * 0.9) % 1; // 0 to 1
      const ringScale = baseDiameter * 1.08 * (0.9 + wavePhase * 0.55);
      ringRef.current.scale.set(ringScale, ringScale, 1);
      ringRef.current.material.opacity = 0.8 * Math.pow(1 - wavePhase, 1.4);
    }
  });

  return (
    <group position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Primary ambient heat aura disc */}
      <mesh ref={glowRef} geometry={UNIT_PLANE_GEO} scale={[baseDiameter, baseDiameter, 1]} renderOrder={2}>
        <meshBasicMaterial
          map={heatTex}
          color={color}
          transparent
          opacity={0.38}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Expanding heat-hazard ring (rendered only when dangerous to human workers) */}
      {isDanger && (
        <mesh ref={ringRef} geometry={UNIT_PLANE_GEO} scale={[baseDiameter * 1.08, baseDiameter * 1.08, 1]} renderOrder={3}>
          <meshBasicMaterial
            map={ringTex}
            color="#ef4444"
            transparent
            opacity={0.8}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
});

export default SensorHeatAura;
