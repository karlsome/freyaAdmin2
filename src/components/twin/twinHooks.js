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

/** Deterministic 32-bit avalanche hash (Murmur3 finalizer) so adjacent IDs like OZNC01/OZNC02 are uncorrelated. */
export function hashString(id = "") {
  let h = 2166136261;
  const s = String(id);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic [0, 1) float from a string key + optional salt. */
export function hashUnit(id, salt = 0) {
  return (hashString(`${id}:${salt}`) % 100000) / 100000;
}

/** Stable per-machine animation phase so machines don't move in lockstep. */
export function phaseFor(id) {
  return hashUnit(id, 0) * Math.PI * 2;
}

