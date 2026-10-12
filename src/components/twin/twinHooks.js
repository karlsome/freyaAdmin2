import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

/** Records the scene clock time whenever the live cycle count goes up (drives the cycle flash). */
export function useCycleFlash(cycle) {
  const clock = useThree((s) => s.clock);
  const flashRef = useRef(null);
  const prev = useRef(cycle);
  useEffect(() => {
    if (prev.current !== null && prev.current !== undefined && cycle > prev.current) {
      flashRef.current = clock.getElapsedTime();
    }
    prev.current = cycle;
  }, [cycle, clock]);
  return flashRef;
}

/** Stable per-machine animation phase so machines don't move in lockstep. */
export function phaseFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return (h / 1000) * Math.PI * 2;
}
