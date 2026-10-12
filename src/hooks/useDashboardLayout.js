import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SLOTS, LAYOUT_MODES, WIDGETS } from "../components/panels/widgetRegistry";

const STORAGE_PREFIX = "freya.dashboard.layout.v1:";

function sanitize(saved) {
  const mode = LAYOUT_MODES[saved?.mode] ? Number(saved.mode) : 1;
  const slots = {};
  Object.keys(LAYOUT_MODES).forEach((m) => {
    const count = LAYOUT_MODES[m].areas.length;
    const list = Array.isArray(saved?.slots?.[m]) ? saved.slots[m] : [];
    const used = new Set();
    slots[m] = Array.from({ length: count }, (_, i) => {
      const id = list[i];
      if (WIDGETS[id] && !used.has(id)) {
        used.add(id);
        return id;
      }
      // fall back to the default, or the first widget not used yet
      const fallback = [DEFAULT_SLOTS[m][i], ...Object.keys(WIDGETS)].find((w) => w && !used.has(w));
      used.add(fallback);
      return fallback;
    });
  });
  return { mode, slots };
}

function load(factory) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + factory);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitize(null);
  }
}

/**
 * Layout mode (1–4) and which widget sits in each slot, saved per factory in localStorage.
 */
export function useDashboardLayout(factory) {
  const [state, setState] = useState(() => load(factory));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + factory, JSON.stringify(state));
    } catch {
      /* storage full or blocked — layout just won't persist */
    }
  }, [factory, state]);

  const setMode = useCallback((mode) => {
    if (!LAYOUT_MODES[mode]) return;
    setState((s) => ({ ...s, mode: Number(mode) }));
  }, []);

  /** Put a widget in a slot of the current mode. If it's already elsewhere, the two slots swap. */
  const setSlotWidget = useCallback((index, widgetId) => {
    if (!WIDGETS[widgetId]) return;
    setState((s) => {
      const list = [...s.slots[s.mode]];
      const existing = list.indexOf(widgetId);
      if (existing === index) return s;
      if (existing >= 0) list[existing] = list[index];
      list[index] = widgetId;
      return { ...s, slots: { ...s.slots, [s.mode]: list } };
    });
  }, []);

  /** Replace several slots at once (used by the AI copilot). */
  const applySlots = useCallback((mode, list) => {
    setState((s) => sanitize({ mode, slots: { ...s.slots, [mode]: list } }));
  }, []);

  const resetMode = useCallback(() => {
    setState((s) => ({ ...s, slots: { ...s.slots, [s.mode]: [...DEFAULT_SLOTS[s.mode]] } }));
  }, []);

  return {
    mode: state.mode,
    slots: state.slots[state.mode],
    allSlots: state.slots,
    setMode,
    setSlotWidget,
    applySlots,
    resetMode,
  };
}
