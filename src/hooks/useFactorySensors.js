import { useCallback, useEffect, useRef, useState } from "react";
import { calcWBGT, fetchSensorData } from "../services/api";
import { getFactoryAnnotations, syncFactoryAnnotations } from "../data/factoryLayouts/annotations";
import { isDemoMode } from "../components/twin/twinDemo";

const SENSOR_POLL_MS = 15_000;

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

  const load = useCallback(async () => {
    if (!factoryName) return;
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      await syncFactoryAnnotations(factoryName);
      const annotations = getFactoryAnnotations(factoryName);
      const baseSensors = annotations.sensors || [];

      // Attempt live sensor fetch for today
      let liveSensors = [];
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const sensorData = await fetchSensorData(factoryName, todayStr);
        if (sensorData?.sensors?.length) {
          liveSensors = sensorData.sensors;
        }
      } catch {
        // Fall back to pre-configured defaults if offline
      }

      const isDemo = isDemoMode();

      // Merge base annotations with live sensor readings
      const resolved = baseSensors.map((s, idx) => {
        // Find matching live sensor by deviceId or fallback index
        const live = liveSensors.find(
          (ls) => ls.deviceId === s.deviceId || (s.deviceId && ls.deviceId?.includes(s.deviceId))
        );

        let temp = live?.temperature ?? s.defaultTemp ?? 24.5;
        let humidity = live?.humidity ?? s.defaultHumidity ?? 50;

        // Subtle realistic drift in preview/demo mode
        if (isDemo || !live) {
          const drift = Math.sin(Date.now() / 15000 + idx) * 0.3;
          temp = Math.round((temp + drift) * 10) / 10;
        }

        const heat = evaluateHeatStress(temp, humidity);

        return {
          ...s,
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

      setSensors(resolved);
      setLastUpdate(new Date());
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [factoryName]);

  useEffect(() => {
    setLoading(true);
    void load();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, SENSOR_POLL_MS);

    const onAnnotationsChanged = (e) => {
      if (!e.detail?.factoryName || e.detail.factoryName === factoryName) {
        void load();
      }
    };
    window.addEventListener("freya:annotations-changed", onAnnotationsChanged);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("freya:annotations-changed", onAnnotationsChanged);
    };
  }, [factoryName, load]);

  return { sensors, loading, lastUpdate, refresh: load };
}
