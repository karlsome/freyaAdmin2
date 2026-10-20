import { useCallback, useEffect, useRef, useState } from "react";
import { calcWBGT, fetchIoTDeviceNames, fetchSensorData } from "../services/api";
import { getFactoryAnnotations } from "../data/factoryLayouts/annotations";
import { KOSE_DEFAULT_SENSORS } from "../data/factoryLayouts/kose";
import { getMachinePositionForFactory } from "../data/factoryLayouts";
import { isDemoMode } from "../components/twin/twinDemo";

const SENSOR_POLL_MS = 15_000;

const LEGACY_FAKE_IDS = new Set([
  "oze_env_01",
  "oze_env_02",
  "oze_env_03",
  "oze_sensor_srs",
  "oze_sensor_east",
  "oze_sensor_shipping",
  "68:FE:71:32:3E:98",
]);

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
 * Infers a floor coordinate [x, z] from a sensor's real name (e.g. "Sensor 1 - OZNC11" or "Sensor 2 - 入口")
 * if the sensor doesn't yet have a saved 3D position.
 */
function inferPositionFromName(name = "", idx = 0, factoryName = "小瀬") {
  const upper = String(name).toUpperCase();
  const machineMatch = upper.match(/OZNC\d{2}|OZMANAS|AOL-\d|SCNA-MANAS|SCNA-PSA|SRS\s?\d/);
  if (machineMatch) {
    const mPos = getMachinePositionForFactory(machineMatch[0], factoryName);
    if (mPos) {
      const offsetX = mPos[0] < 0 ? 1.1 : -1.1;
      return [Number((mPos[0] + offsetX).toFixed(2)), Number(mPos[1].toFixed(2))];
    }
  }
  if (name.includes("入口")) {
    return [0, 5.08];
  }
  const fallback = KOSE_DEFAULT_SENSORS[idx % KOSE_DEFAULT_SENSORS.length];
  return fallback?.pos || [0, 0];
}

/**
 * Loads all real sensors for the factory from submittedDB.tempHumidityDB + ioTNames,
 * maps them to their real names and 3D floor coordinates, and evaluates WBGT heat stress.
 */
export function useFactorySensors(factoryName) {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const inFlight = useRef(false);
  const liveReadingsRef = useRef([]);
  const iotNamesRef = useRef(new Map());

  const buildResolvedSensors = useCallback(
    (liveSensors = liveReadingsRef.current, iotMap = iotNamesRef.current) => {
      const annotations = getFactoryAnnotations(factoryName);
      const savedSensors = (annotations.sensors || []).filter(
        (s) => !LEGACY_FAKE_IDS.has(s.id) && !LEGACY_FAKE_IDS.has(s.deviceId)
      );

      // Use real DB device IDs whenever available; only fall back to KOSE_DEFAULT_SENSORS when offline
      const deviceIdSet = new Set();
      iotMap.forEach((_, devId) => {
        if (devId && !LEGACY_FAKE_IDS.has(devId)) deviceIdSet.add(devId);
      });
      liveSensors.forEach((ls) => {
        if (ls.deviceId && !LEGACY_FAKE_IDS.has(ls.deviceId)) deviceIdSet.add(ls.deviceId);
      });
      const isKose = !factoryName || factoryName.includes("小瀬") || String(factoryName).toLowerCase().includes("oze");
      if (deviceIdSet.size === 0 && isKose) {
        KOSE_DEFAULT_SENSORS.forEach((d) => {
          if (d.deviceId) deviceIdSet.add(d.deviceId);
        });
      }

      const allDeviceIds = Array.from(deviceIdSet);
      const isDemo = isDemoMode();

      return allDeviceIds.map((deviceId, idx) => {
        const defaultDef =
          KOSE_DEFAULT_SENSORS.find((d) => d.deviceId === deviceId || d.id === deviceId) || {};
        const savedOverride =
          savedSensors.find((s) => s.deviceId === deviceId || s.id === deviceId) || null;
        const live = liveSensors.find((ls) => ls.deviceId === deviceId) || null;
        const iotMeta = iotMap.get(deviceId) || null;

        // Real name priority: ioTNames DB -> live reading name -> default seed name -> deviceId MAC
        const realName =
          iotMeta?.name ||
          live?.name ||
          defaultDef.name ||
          savedOverride?.name ||
          deviceId;

        const pos = Array.isArray(savedOverride?.pos)
          ? savedOverride.pos
          : Array.isArray(savedOverride?.position)
            ? savedOverride.position
            : Array.isArray(defaultDef.pos)
              ? defaultDef.pos
              : inferPositionFromName(realName, idx, factoryName);

        let temp = live?.temperature ?? defaultDef.defaultTemp ?? 20.0;
        let humidity = live?.humidity ?? defaultDef.defaultHumidity ?? 40.0;

        if (isDemo && !live) {
          const drift = Math.sin(Date.now() / 15000 + idx) * 0.3;
          temp = Math.round((temp + drift) * 10) / 10;
        } else {
          temp = Math.round(Number(temp) * 10) / 10;
          humidity = Math.round(Number(humidity) * 10) / 10;
        }

        const heat = evaluateHeatStress(temp, humidity);

        return {
          ...defaultDef,
          id: deviceId,
          deviceId,
          name: realName,
          nameJa: realName,
          pos,
          radius: savedOverride?.radius ?? defaultDef.radius ?? 3.0,
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
      const todayStr = todayJST();
      const [sensorDataRes, iotRecordsRes] = await Promise.allSettled([
        fetchSensorData(factoryName, todayStr),
        fetchIoTDeviceNames(factoryName),
      ]);

      const nextIoTMap = new Map();
      if (iotRecordsRes.status === "fulfilled" && Array.isArray(iotRecordsRes.value)) {
        iotRecordsRes.value.forEach((r) => {
          const id = String(r?.deviceId ?? "").trim();
          if (id) {
            nextIoTMap.set(id, {
              name: r.name ? String(r.name).trim() : "",
              offset: Number(r.offset) || 0,
            });
          }
        });
      }

      const liveSensors =
        sensorDataRes.status === "fulfilled" && Array.isArray(sensorDataRes.value?.sensors)
          ? sensorDataRes.value.sensors
          : [];

      iotNamesRef.current = nextIoTMap;
      liveReadingsRef.current = liveSensors;
      setSensors(buildResolvedSensors(liveSensors, nextIoTMap));
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
        setSensors(buildResolvedSensors(liveReadingsRef.current, iotNamesRef.current));
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
