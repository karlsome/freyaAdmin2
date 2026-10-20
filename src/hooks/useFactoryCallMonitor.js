import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BASE_URL } from "../services/factoryStatusApi";
import { isDemoMode } from "../components/twin/twinDemo";
import { normalizeFactoryMachineId } from "../data/factoryLayouts";

const STALE_MS = 70_000;

export const CALL_THEMES = {
  leader: {
    key: "leader",
    color: "#e11d2a",
    glow: "#ff2a39",
    badgeBg: "rgba(225, 29, 42, 0.92)",
    labelJa: "リーダー呼出",
    labelEn: "LEADER CALL",
    shortJa: "呼出",
    shortEn: "CALL",
    icon: "campaign",
  },
  stop: {
    key: "stop",
    color: "#9333ea",
    glow: "#a855f7",
    badgeBg: "rgba(147, 51, 234, 0.92)",
    labelJa: "停止待ち",
    labelEn: "STOP QUEUED",
    shortJa: "停止待",
    shortEn: "STOP",
    icon: "pan_tool",
  },
  box: {
    key: "box",
    color: "#d97706",
    glow: "#f59e0b",
    badgeBg: "rgba(217, 119, 6, 0.94)",
    labelJa: "空箱リクエスト",
    labelEn: "BOX REQUEST",
    shortJa: "空箱",
    shortEn: "BOX",
    icon: "inventory_2",
  },
  material: {
    key: "material",
    color: "#2563eb",
    glow: "#3b82f6",
    badgeBg: "rgba(37, 99, 235, 0.94)",
    labelJa: "部材リクエスト",
    labelEn: "MATERIAL ROLL",
    shortJa: "部材",
    shortEn: "ROLL",
    icon: "album",
  },
};

export function getPrimaryCallType(call) {
  if (!call) return null;
  if (call.leader) return "leader";
  if (call.stop) return "stop";
  if (call.box) return "box";
  if (call.material) return "material";
  return "leader";
}

export function formatCallWait(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

const DEMO_INITIAL_CALLS = [
  {
    machine: "OZNC17",
    leader: true,
    stop: false,
    box: false,
    material: false,
    since: Date.now() - 142_000,
  },
  {
    machine: "OZNC04",
    leader: false,
    stop: false,
    box: true,
    material: false,
    since: Date.now() - 85_000,
  },
  {
    machine: "OZNC11",
    leader: false,
    stop: false,
    box: false,
    material: true,
    zairyoSebanggo: "7GD-R02",
    since: Date.now() - 52_000,
  },
];

const DEMO_INITIAL_CALLS_SCNA = [
  {
    machine: "AOL-1",
    leader: true,
    stop: false,
    box: false,
    material: false,
    since: Date.now() - 125_000,
  },
  {
    machine: "SCNA-PSA",
    leader: false,
    stop: false,
    box: false,
    material: true,
    zairyoSebanggo: "PSA-R04",
    since: Date.now() - 68_000,
  },
];

function defaultDemoCallsFor(factoryName) {
  if (String(factoryName).toUpperCase().includes("SCNA")) {
    return DEMO_INITIAL_CALLS_SCNA;
  }
  return DEMO_INITIAL_CALLS;
}

/**
 * Connects to the real-time factory Stop-Call & Machine State SSE stream (`/sse/factory/:factory`),
 * matching `factory-stopcall-tv.html` in the Kurachi repository.
 * Also supports local simulation/demo calls for testing the 3D animations without triggering floor sirens.
 */
export function useFactoryCallMonitor(factoryName = "小瀬") {
  const [serverCalls, setServerCalls] = useState([]);
  const [simulatedCalls, setSimulatedCalls] = useState(() => (isDemoMode() ? defaultDemoCallsFor(factoryName) : []));
  const [liveMachines, setLiveMachines] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const esRef = useRef(null);
  const lastMsgRef = useRef(Date.now());
  const reconnectTimerRef = useRef(null);

  const hasAnyCalls = serverCalls.length > 0 || simulatedCalls.length > 0;

  // Tick once per second ONLY when there are active calls that need live wait-time counters
  useEffect(() => {
    if (!hasAnyCalls) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [hasAnyCalls]);

  useEffect(() => {
    if (!factoryName) return undefined;

    const baseUrlNoSlash = BASE_URL.replace(/\/$/, "");
    const sseUrl = `${baseUrlNoSlash}/sse/factory/${encodeURIComponent(factoryName)}`;

    const closeES = () => {
      if (esRef.current) {
        try {
          esRef.current.onopen = null;
          esRef.current.onmessage = null;
          esRef.current.onerror = null;
          esRef.current.close();
        } catch {
          // ignore
        }
        esRef.current = null;
      }
    };

    const scheduleReconnect = (delay = 3000) => {
      if (reconnectTimerRef.current) return;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    const handlePayload = (data) => {
      if (!data || typeof data !== "object") return;
      if (data.type === "ping" || data.type === "connected") {
        setIsConnected(true);
      } else if (data.type === "stopcall") {
        setIsConnected(true);
        const list = Array.isArray(data.active) ? data.active : [];
        setServerCalls(list);
      } else if (data.type === "machine_state" && Array.isArray(data.machines)) {
        setIsConnected(true);
        setLiveMachines((prev) => {
          const next = { ...prev };
          data.machines.forEach((m) => {
            if (!m || !m.equipment) return;
            const normEq = normalizeFactoryMachineId(m.equipment, factoryName);
            next[m.equipment] = { ...m };
            next[normEq] = { ...m, equipment: normEq };
            // If equipment is grouped (e.g. "OZNC03,OZNC05" or "AOL-2,AOL-3"), also index by constituent
            if (m.equipment.includes(",")) {
              m.equipment.split(",").forEach((part) => {
                const clean = normalizeFactoryMachineId(part.trim(), factoryName);
                if (clean && !next[clean]) next[clean] = { ...m, equipment: clean };
              });
            }
          });
          return next;
        });
      }
    };

    function connect() {
      closeES();
      try {
        const es = new EventSource(sseUrl);
        esRef.current = es;
        lastMsgRef.current = Date.now();

        es.onopen = () => {
          lastMsgRef.current = Date.now();
          setIsConnected(true);
        };

        es.onmessage = (ev) => {
          lastMsgRef.current = Date.now();
          try {
            const parsed = JSON.parse(ev.data);
            handlePayload(parsed);
          } catch {
            // ignore malformed JSON
          }
        };

        es.onerror = () => {
          setIsConnected(false);
          if (!esRef.current || esRef.current.readyState === 2) {
            scheduleReconnect(3000);
          }
        };
      } catch {
        setIsConnected(false);
        scheduleReconnect(4000);
      }
    }

    connect();

    // Watchdog matching factory-stopcall-tv.html (reconnect if silent > 70s)
    const watchdog = window.setInterval(() => {
      if (Date.now() - lastMsgRef.current > STALE_MS) {
        setIsConnected(false);
        connect();
      }
    }, 15_000);

    // Expose global test helper matching factory-stopcall-tv.html
    window.__applyStopCallPayload = handlePayload;

    return () => {
      window.clearInterval(watchdog);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      closeES();
    };
  }, [factoryName]);

const EMPTY_CALLS = [];
const EMPTY_CALLS_MAP = {};

  // Merge real server calls + any admin-simulated calls, sorted oldest-first (`since` ascending)
  const activeCalls = useMemo(() => {
    if (serverCalls.length === 0 && simulatedCalls.length === 0) return EMPTY_CALLS;
    const mergedMap = new Map();
    serverCalls.forEach((c) => {
      if (c && c.machine) {
        const machine = normalizeFactoryMachineId(c.machine, factoryName);
        mergedMap.set(machine, { ...c, machine, isSimulated: false });
      }
    });
    simulatedCalls.forEach((c) => {
      if (c && c.machine) {
        const machine = normalizeFactoryMachineId(c.machine, factoryName);
        mergedMap.set(machine, { ...c, machine, isSimulated: true });
      }
    });

    const sorted = Array.from(mergedMap.values())
      .filter((c) => c.leader || c.stop || c.box || c.material)
      .sort((a, b) => (a.since || 0) - (b.since || 0));

    if (sorted.length === 0) return EMPTY_CALLS;

    return sorted.map((c, idx) => {
      const primaryCall = getPrimaryCallType(c);
      const waitMs = Math.max(0, now - (c.since || now));
      return {
        ...c,
        rank: idx + 1,
        primaryCall,
        theme: CALL_THEMES[primaryCall] || CALL_THEMES.leader,
        waitMs,
        waitFormatted: formatCallWait(waitMs),
      };
    });
  }, [serverCalls, simulatedCalls, now]);

  // Fast O(1) lookup by machine ID (including constituents if a paired machine name was used)
  const callsByMachine = useMemo(() => {
    if (activeCalls.length === 0) return EMPTY_CALLS_MAP;
    const map = {};
    activeCalls.forEach((call) => {
      map[call.machine] = call;
      if (call.machine.includes(",")) {
        call.machine.split(",").forEach((part) => {
          const clean = part.trim();
          if (clean && !map[clean]) map[clean] = call;
        });
      }
    });
    return map;
  }, [activeCalls]);

  // Helper to toggle or trigger a simulated call on any machine for testing 3D animations
  const toggleSimulatedCall = useCallback((machineId, callType = "leader", zairyoSebanggo = "7GD-ROLL") => {
    if (!machineId) return;
    setSimulatedCalls((prev) => {
      const existing = prev.find((c) => c.machine === machineId);
      if (!existing) {
        return [
          ...prev,
          {
            machine: machineId,
            leader: callType === "leader",
            stop: callType === "stop",
            box: callType === "box",
            material: callType === "material",
            zairyoSebanggo: callType === "material" ? zairyoSebanggo : "",
            since: Date.now(),
          },
        ];
      }
      const updated = {
        ...existing,
        [callType]: !existing[callType],
        zairyoSebanggo:
          callType === "material" && !existing.material ? zairyoSebanggo : existing.zairyoSebanggo,
      };
      if (!updated.leader && !updated.stop && !updated.box && !updated.material) {
        return prev.filter((c) => c.machine !== machineId);
      }
      return prev.map((c) => (c.machine === machineId ? updated : c));
    });
  }, []);

  const clearSimulatedCalls = useCallback(() => {
    setSimulatedCalls([]);
  }, []);

  const loadDemoPreset = useCallback(() => {
    const preset = defaultDemoCallsFor(factoryName);
    setSimulatedCalls(
      preset.map((c, idx) => ({
        ...c,
        since: Date.now() - (120 - idx * 35) * 1000,
      }))
    );
  }, [factoryName]);

  return {
    activeCalls,
    callsByMachine,
    liveMachines,
    isConnected,
    now,
    hasSimulatedCalls: simulatedCalls.length > 0,
    toggleSimulatedCall,
    clearSimulatedCalls,
    loadDemoPreset,
  };
}

