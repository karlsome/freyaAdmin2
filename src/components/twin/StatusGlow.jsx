import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { getGlowTexture, getOutlineTexture } from "./twinTextures";
import { STATUS_THEME } from "./twinTheme";

/**
 * Soft colored glow under a machine footprint, with an expanding pulse
 * for statuses that need attention, a short flash on each new cycle,
 * and a dashed outline when selected.
 */
export default function StatusGlow({ width, depth, status, selected, flashRef }) {
  const theme = STATUS_THEME[status] || STATUS_THEME.off;
  const glowRef = useRef();
  const pulseRef = useRef();
  const glowTex = useMemo(() => getGlowTexture(), []);
  const outlineTex = useMemo(() => getOutlineTexture(), []);
  const baseOpacity = status === "off" ? 0.18 : 0.62;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const flashAge = flashRef?.current ? t - flashRef.current : Infinity;
    const flash = flashAge < 1.2 ? 1 - flashAge / 1.2 : 0;

    if (glowRef.current) {
      const breathe = theme.pulse ? 0.18 * Math.sin(t * 4) : 0;
      glowRef.current.material.opacity = Math.min(1, baseOpacity + breathe + flash * 0.5);
    }
    if (pulseRef.current) {
      const phase = (t * 0.8) % 1;
      const s = 1 + phase * 0.45;
      pulseRef.current.scale.set(s, s, 1);
      pulseRef.current.material.opacity = theme.pulse ? 0.7 * (1 - phase) : 0;
    }
  });

  return (
    <group position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={glowRef} renderOrder={1}>
        <planeGeometry args={[width * 1.45, depth * 1.9]} />
        <meshBasicMaterial map={glowTex} color={theme.color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {theme.pulse && (
        <mesh ref={pulseRef} renderOrder={1}>
          <planeGeometry args={[width * 1.3, depth * 1.6]} />
          <meshBasicMaterial map={outlineTex} color={theme.color} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0, 0.002]} renderOrder={2}>
          <planeGeometry args={[width * 1.18, depth * 1.45]} />
          <meshBasicMaterial map={outlineTex} color="#ffffff" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
