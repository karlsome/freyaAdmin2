import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../src/index.css";
import "../src/styles/freya-design-language.css";
import "../src/components/twin/twin.css";
import "../src/components/panels/panels.css";
import TwinPanel from "../src/components/panels/TwinPanel";
import MachineDrawer from "../src/components/twin/MachineDrawer";
import { useDigitalTwin } from "../src/hooks/useDigitalTwin";
import { getFactory3DLayout, has3DLayout, machineIdsFor, normalizeFactoryMachineId } from "../src/data/factoryLayouts";
import { STATUS_ORDER, effectiveStatus } from "../src/components/twin/twinTheme";
import { attentionUnits, buildUnits } from "../src/components/panels/twinUnits";

// factory3D.html?filter=SCNA  (also accepts ?factory=, ?lang=ja (default en), ?theme=light|dark)
const params = new URLSearchParams(window.location.search);
const FACTORY = params.get("filter") || params.get("factory") || "SCNA";
// Initial camera distance multiplier (<1 = closer). Override: ?zoom=0.7
window.__twinOverviewScale = Number(params.get("zoom")) || 0.78;
// Weak-graphics friendly by default (no shadows, no antialiasing, 1x pixel ratio). ?lite=0 for full quality.
window.__twinDefaultLite = params.get("lite") !== "0";
const IS_JA = (params.get("lang") || "en") === "ja";
const IS_DARK = params.get("theme") ? params.get("theme") === "dark" : false;

function App() {
  const factory = FACTORY;
  const has3D = has3DLayout(factory);
  const { data, loading, error } = useDigitalTwin(factory);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", IS_DARK);
    document.title = `Factory 3D – ${factory}`;
    const onKey = (e) => { if (e.key === "Escape") setSelectedId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [factory]);

  const machinesById = useMemo(() => {
    const map = {};
    const layout3d = has3D ? getFactory3DLayout(factory) : null;
    const defaultSpecs = layout3d?.defaultSpecs || {};
    const defaultPairs = new Map();
    (layout3d?.pairs || []).forEach(([a, b]) => { defaultPairs.set(a, b); defaultPairs.set(b, a); });
    (data?.machines || []).forEach((m) => {
      const canonicalId = normalizeFactoryMachineId(m.id, factory);
      const spec = defaultSpecs[canonicalId] || {};
      const defaultPartner = defaultPairs.get(canonicalId);
      const pair = m.pair
        ? { ...m.pair, partner: normalizeFactoryMachineId(m.pair.partner, factory) }
        : defaultPartner ? { partner: defaultPartner, together: false } : null;
      const merged = { ...spec, ...m, id: canonicalId, pair };
      map[m.id] = merged;
      map[canonicalId] = merged;
    });
    if (layout3d) {
      machineIdsFor(factory).forEach((id) => {
        if (!map[id]) {
          const partner = defaultPairs.get(id);
          map[id] = { id, status: "off", todayCycles: 0, pieces: null, ...(defaultSpecs[id] || {}), pair: partner ? { partner, together: false } : null };
        }
      });
    }
    return map;
  }, [data, factory, has3D]);

  const machineIds = useMemo(() => machineIdsFor(factory, data?.machines || []), [factory, data]);
  const units = useMemo(() => buildUnits(machinesById, machineIds), [machinesById, machineIds]);
  const attention = useMemo(() => attentionUnits(units), [units]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
    machineIds.forEach((id) => { c[effectiveStatus(machinesById[id])] += 1; });
    return c;
  }, [machineIds, machinesById]);

  const selected = selectedId ? machinesById[selectedId] || { id: selectedId, status: "off" } : null;
  const partner = selected?.pair?.together ? machinesById[selected.pair.partner] : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: IS_DARK ? "#0b0f17" : "#f4f6f8" }}>
      <TwinPanel
        factory={factory}
        machinesById={machinesById}
        selectedId={selectedId}
        onSelect={setSelectedId}
        isDark={IS_DARK}
        isJa={IS_JA}
        attention={attention}
        counts={counts}
        hasData={Boolean(data)}
        error={error}
        loading={loading}
        drawerCovers={false}
        has3D={has3D}
        units={units}
        hasSensors={Boolean(data?.hasCycleSensors)}
        onOpenCamera={() => {}}
        callSounds
      />
      <MachineDrawer machine={selected} partner={partner} isJa={IS_JA} onClose={() => setSelectedId(null)} onCamera={() => {}} onDetails={() => {}} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
