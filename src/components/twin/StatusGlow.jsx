import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getGlowTexture, getOutlineTexture } from "./twinTextures";
import { STATUS_THEME } from "./twinTheme";

const UNIT_PLANE_GEO = new THREE.PlaneGeometry(1, 1);

/**
 * Soft colored glow under a machine footprint, with an expanding pulse
 * for statuses that need attention, a short flash on each new cycle,
 * and a dashed outline when selected.
 */
const StatusGlow = memo(function StatusGlow({ width, depth, status, selected, flashRef }) {
  const theme = STATUS_THEME[status] || STATUS_THEME.off;
  const glowRef = useRef();
  const pulseRef = useRef();
  const glowTex = useMemo(() => getGlowTexture(), []);
  const outlineTex = useMemo(() => getOutlineTexture(), []);
  const baseOpacity = status === "off" ? 0.18 : 0.62;

  useFrame(({ clock }) => {
    const hasFlash = flashRef?.current !== null && flashRef?.current !== undefined;
    if (!theme.pulse && !hasFlash) {
      if (glowRef.current && glowRef.current.material.opacity !== baseOpacity) {
        glowRef.current.material.opacity = baseOpacity;
      }
      return;
    }

    const t = clock.getElapsedTime();
    const flashAge = hasFlash ? t - flashRef.current : Infinity;
    const flash = flashAge < 1.2 ? 1 - flashAge / 1.2 : 0;

    if (!theme.pulse && flash === 0) {
      if (glowRef.current && glowRef.current.material.opacity !== baseOpacity) {
        glowRef.current.material.opacity = baseOpacity;
      }
      return;
    }

    if (glowRef.current) {
      const breathe = theme.pulse ? 0.18 * Math.sin(t * 4) : 0;
      glowRef.current.material.opacity = Math.min(1, baseOpacity + breathe + flash * 0.5);
    }
    if (pulseRef.current && theme.pulse) {
      const phase = (t * 0.8) % 1;
      const s = 1 + phase * 0.45;
      pulseRef.current.scale.set(width * 1.3 * s, depth * 1.6 * s, 1);
      pulseRef.current.material.opacity = 0.7 * (1 - phase);
    }
  });

  return (
    <group position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={glowRef} geometry={UNIT_PLANE_GEO} scale={[width * 1.45, depth * 1.9, 1]} renderOrder={1}>
        <meshBasicMaterial map={glowTex} color={theme.color} transparent opacity={baseOpacity} depthWrite={false} toneMapped={false} />
      </mesh>
      {theme.pulse && (
        <mesh ref={pulseRef} geometry={UNIT_PLANE_GEO} scale={[width * 1.3, depth * 1.6, 1]} renderOrder={1}>
          <meshBasicMaterial map={outlineTex} color={theme.color} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0, 0.002]} geometry={UNIT_PLANE_GEO} scale={[width * 1.18, depth * 1.45, 1]} renderOrder={2}>
          <meshBasicMaterial map={outlineTex} color="#ffffff" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
});

export default StatusGlow;
