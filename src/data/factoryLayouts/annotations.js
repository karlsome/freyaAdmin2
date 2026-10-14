import { KOSE_DEFAULT_SENSORS, KOSE_DEFAULT_CAMERAS, KOSE_DEFAULT_MONITOR } from "./kose";
import { fetchTwinAnnotations, saveTwinAnnotations, resetTwinAnnotations } from "../../services/api";

const STORAGE_PREFIX = "freya_twin_annotations_";
const _memoryCache = new Map();

const LEGACY_FAKE_SENSOR_IDS = new Set([
  "oze_env_01",
  "oze_env_02",
  "oze_env_03",
  "oze_sensor_srs",
  "oze_sensor_east",
  "oze_sensor_shipping",
  "68:FE:71:32:3E:98",
]);

function sanitizeSensors(sensors, fallbackSensors) {
  if (!Array.isArray(sensors)) return fallbackSensors;
  const valid = sensors.filter(
    (s) => s && !LEGACY_FAKE_SENSOR_IDS.has(s.id) && !LEGACY_FAKE_SENSOR_IDS.has(s.deviceId)
  );
  return valid.length > 0 ? valid : fallbackSensors;
}

function sanitizeCameras(cameras, fallbackCameras) {
  if (!Array.isArray(cameras) || cameras.length === 0) return fallbackCameras;
  if (!Array.isArray(fallbackCameras) || fallbackCameras.length === 0) return cameras;

  return fallbackCameras.map((defCam, idx) => {
    const match =
      cameras.find(
        (c) =>
          c &&
          (c.streamId === defCam.streamId ||
            c.id === defCam.id ||
            c.id === defCam.streamId ||
            c.streamId === defCam.id)
      ) || cameras[idx];
    if (!match) return defCam;

    const pos = Array.isArray(match.pos)
      ? match.pos
      : Array.isArray(match.position)
        ? match.position
        : defCam.pos;

    return {
      ...defCam,
      ...match,
      id: defCam.id,
      streamId: defCam.streamId,
      pos,
      rotationY: typeof match.rotationY === "number" ? match.rotationY : defCam.rotationY,
    };
  });
}

function getDefaultAnnotations(factoryName) {
  if (!factoryName) return { sensors: [], cameras: [], callMonitor: null };
  if (factoryName.includes("小瀬") || factoryName.toLowerCase().includes("oze")) {
    return {
      sensors: [...KOSE_DEFAULT_SENSORS],
      cameras: [...KOSE_DEFAULT_CAMERAS],
      callMonitor: { ...KOSE_DEFAULT_MONITOR },
    };
  }
  return { sensors: [], cameras: [], callMonitor: null };
}

/**
 * Returns the currently active 3D annotations (sensors, cameras, callMonitor) for a given factory.
 * Checks memory cache -> localStorage -> pre-seeded defaults.
 * Synchronous for immediate rendering without UI delay.
 */
export function getFactoryAnnotations(factoryName) {
  if (!factoryName) return { sensors: [], cameras: [], callMonitor: null };

  if (_memoryCache.has(factoryName)) {
    return _memoryCache.get(factoryName);
  }

  const defaults = getDefaultAnnotations(factoryName);
  const storageKey = `${STORAGE_PREFIX}${factoryName}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sensors) && Array.isArray(parsed.cameras)) {
        const cleaned = {
          ...parsed,
          sensors: sanitizeSensors(parsed.sensors, defaults.sensors),
          cameras: sanitizeCameras(parsed.cameras, defaults.cameras),
          callMonitor: parsed.callMonitor ? { ...defaults.callMonitor, ...parsed.callMonitor } : defaults.callMonitor,
        };
        _memoryCache.set(factoryName, cleaned);
        return cleaned;
      }
    }
  } catch {
    // Fallback if parsing fails
  }

  _memoryCache.set(factoryName, defaults);
  return defaults;
}

/**
 * Synchronizes annotations with the permanent MongoDB backend.
 * Ensures anyone viewing the dashboard sees the latest permanent positions.
 */
export async function syncFactoryAnnotations(factoryName) {
  if (!factoryName) return getDefaultAnnotations(factoryName);
  const defaults = getDefaultAnnotations(factoryName);

  try {
    const cloud = await fetchTwinAnnotations(factoryName);
    if (cloud && (cloud.sensors?.length > 0 || cloud.cameras?.length > 0)) {
      const payload = {
        sensors: sanitizeSensors(cloud.sensors, defaults.sensors),
        cameras: sanitizeCameras(cloud.cameras, defaults.cameras),
        callMonitor: cloud.callMonitor ? { ...defaults.callMonitor, ...cloud.callMonitor } : defaults.callMonitor,
        updatedAt: cloud.updatedAt || Date.now(),
      };
      _memoryCache.set(factoryName, payload);
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${factoryName}`, JSON.stringify(payload));
      } catch (_) {}

      window.dispatchEvent(
        new CustomEvent("freya:annotations-changed", { detail: { factoryName, payload, source: "cloud" } })
      );
      return payload;
    }
  } catch (err) {
    console.warn("syncFactoryAnnotations error, using cached coordinates:", err);
  }

  return getFactoryAnnotations(factoryName);
}

/**
 * Persists updated sensor/camera/callMonitor annotations permanently to MongoDB
 * as well as localStorage and in-memory cache for instant responsiveness.
 */
export async function saveFactoryAnnotations(factoryName, { sensors, cameras, callMonitor }) {
  if (!factoryName) return;
  const storageKey = `${STORAGE_PREFIX}${factoryName}`;
  const defaults = getDefaultAnnotations(factoryName);
  const payload = {
    sensors: Array.isArray(sensors) ? sensors : [],
    cameras: Array.isArray(cameras) ? cameras : [],
    callMonitor: callMonitor || defaults.callMonitor,
    updatedAt: Date.now(),
  };

  // 1. Immediately update local state & event bus for zero-latency UI
  _memoryCache.set(factoryName, payload);
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to write to localStorage:", err);
  }
  window.dispatchEvent(new CustomEvent("freya:annotations-changed", { detail: { factoryName, payload } }));

  // 2. Permanently save to MongoDB backend so all dashboard viewers see the position
  try {
    await saveTwinAnnotations(factoryName, {
      sensors: payload.sensors,
      cameras: payload.cameras,
      callMonitor: payload.callMonitor,
    });
  } catch (err) {
    console.error("Failed to permanently save annotations to MongoDB:", err);
  }
}

/**
 * Resets annotations back to the factory defaults both locally and in MongoDB.
 */
export async function resetFactoryAnnotations(factoryName) {
  if (!factoryName) return;
  const storageKey = `${STORAGE_PREFIX}${factoryName}`;
  const defaults = getDefaultAnnotations(factoryName);

  _memoryCache.delete(factoryName);
  try {
    localStorage.removeItem(storageKey);
  } catch (_) {}

  window.dispatchEvent(new CustomEvent("freya:annotations-changed", { detail: { factoryName, payload: defaults } }));

  try {
    await resetTwinAnnotations(factoryName);
  } catch (err) {
    console.warn("Failed to reset annotations in MongoDB:", err);
  }
}
