import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "freya.dashboard.chime.v1";
// Louder, double chime for stop calls / CNC cancels; a single soft tone for idle
const URGENT = new Set(["stopCall", "cncCancel"]);

function playChime(urgent) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const notes = urgent ? [880, 660, 880] : [660];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + i * 0.22;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(urgent ? 0.35 : 0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  });
  window.setTimeout(() => ctx.close(), notes.length * 250 + 200);
}

/**
 * Plays a chime when a machine newly enters an attention state (stop call, CNC cancel, idle…).
 * Off by default; the choice is remembered. The first snapshot never chimes.
 */
export function useAlertChime(attention) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  const previous = useRef(null);

  useEffect(() => {
    const current = new Map(attention.map((a) => [a.id, a.status]));
    const before = previous.current;
    previous.current = current;
    if (!enabled || !before) return;
    const fresh = attention.filter((a) => before.get(a.id) !== a.status);
    if (fresh.length) playChime(fresh.some((a) => URGENT.has(a.status)));
  }, [attention, enabled]);

  const toggle = useCallback(() => {
    setEnabled((v) => {
      const next = !v;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      if (next) playChime(false); // confirms sound works (and unlocks audio after a click)
      return next;
    });
  }, []);

  return [enabled, toggle];
}
