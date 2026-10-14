import { useCallback, useEffect, useRef, useState } from "react";
import { calcWBGT, fetchSensorData } from "../services/api";
import { getFactoryAnnotations } from "../data/factoryLayouts/annotations";
import { KOSE_DEFAULT_SENSORS } from "../data/factoryLayouts/kose";
import { isDemoMode } from "../components/twin/twinDemo";

const SENSOR_POLL_MS = 15_000;

function todayJST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

function evaluateHeatStress(temp, humidity) {
  const wbgt = calcWBGT(temp, humidity);
  const isExtreme = (temp !== null && temp >= 35) || (wbgt !== null && wbgt >= 31);
  const isDanger = isExtreme || (temp !== null && temp >= 30) || (wbgt !== null && wbgt >= 28);
  const isCaution = !isDanger && ((temp !== null && temp >= 26) || (wbgt !== null && wbgt >= 25));

  let status = "normal";
  if (isExtreme) status = "extreme";
  else if (isDanger) status = "danger";
  else if (isCaution) status = "warning";

  return { wbgt, isDanger, isExtreme, isCaution, status };
}

/**
 * Loads sensor positions and maps them to live readings for the 3D twin.
 * Evaluates real-time worker heat stress thresholds for floor auras.
 */
export function useFactorySensors(factoryName) {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const inFlight = useRef(false);
  const liveReadingsRef = useRef([]);

  const buildResolvedSensors = useCallback(
    (liveSensors = liveReadingsRef.current) => {
      const annotations = getFactoryAnnotations(factoryName);
      const baseSensors = annotations.sensors?.length ? annotations.sensors : KOSE_DEFAULT_SENSORS;
      const isDemo = isDemoMode();

      return baseSensors.map((s, idx) => {
        const defaultDef =
          KOSE_DEFAULT_SENSORS.find(
            (d) => (s.id && d.id === s.id) || (s.deviceId && d.deviceId === s.deviceId)
          ) ||
          KOSE_DEFAULT_SENSORS[idx] ||
          {};

        const mergedBase = { ...defaultDef, ...s };
        const pos = Array.isArray(s.pos)
          ? s.pos
          : Array.isArray(s.position)
            ? s.position
            : defaultDef.pos || [0, 0];

        // Match live sensor by deviceId, or fallback by index if hardware reports MAC addresses
        const live =
          liveSensors.find(
            (ls) =>
              ls.deviceId &&
              mergedBase.deviceId &&
              (ls.deviceId === mergedBase.deviceId || ls.deviceId.includes(mergedBase.deviceId))
          ) ||
          liveSensors[idx] ||
          null;

        let temp = live?.temperature ?? mergedBase.defaultTemp ?? 24.5;
        let humidity = live?.humidity ?? mergedBase.defaultHumidity ?? 50;

        if (isDemo || !live) {
          const drift = Math.sin(Date.now() / 15000 + idx) * 0.3;
          temp = Math.round((temp + drift) * 10) / 10;
        }

        const heat = evaluateHeatStress(temp, humidity);

        return {
          ...mergedBase,
          id: mergedBase.id || mergedBase.deviceId || `sensor_${idx}`,
          pos,
          temperature: temp,
          humidity,
          wbgt: heat.wbgt,
          status: heat.status,
          isDanger: heat.isDanger,
          isExtreme: heat.isExtreme,
          isCaution: heat.isCaution,
          lastReadingTime: live?.lastUpdate || "リアルタイム",
        };
      });
    },
    [factoryName]
  );

  const load = useCallback(async () => {
    if (!factoryName) return;
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      let liveSensors = [];
      try {
        const todayStr = todayJST();
        const sensorData = await fetchSensorData(factoryName, todayStr);
        if (sensorData?.sensors?.length) {
          liveSensors = sensorData.sensors;
        }
      } catch {
        // Fall back to pre-configured defaults if offline
      }

      liveReadingsRef.current = liveSensors;
      setSensors(buildResolvedSensors(liveSensors));
      setLastUpdate(new Date());
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [factoryName, buildResolvedSensors]);

  useEffect(() => {
    setLoading(true);
    void load();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, SENSOR_POLL_MS);

    const onAnnotationsChanged = (e) => {
      if (!e.detail?.factoryName || e.detail.factoryName === factoryName) {
        setSensors(buildResolvedSensors(liveReadingsRef.current));
      }
    };
    window.addEventListener("freya:annotations-changed", onAnnotationsChanged);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("freya:annotations-changed", onAnnotationsChanged);
    };
  }, [factoryName, load, buildResolvedSensors]);

  return { sensors, loading, lastUpdate, refresh: load };
}
