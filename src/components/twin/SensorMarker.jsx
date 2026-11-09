import { memo, useEffect, useState } from "react";
import * as THREE from "three";
import { Html } from "./HtmlOverlay";
import SensorHeatAura from "./SensorHeatAura";

const STATUS_COLOR = {
  extreme: "#dc2626",
  danger:  "#ef4444",
  warning: "#f59e0b",
  normal:  "#10b981",
};

// Shared static geometries & materials for all floor sensors
const BASE_GEO = new THREE.CylinderGeometry(0.22, 0.26, 0.08, 12);
const ROD_GEO = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8);
const HEAD_GEO = new THREE.BoxGeometry(0.24, 0.28, 0.16);
const LED_GEO = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8);
const ANT_GEO = new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6);
const RING_GEO = new THREE.RingGeometry(0.34, 0.46, 20);

const BASE_MAT = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.6, metalness: 0.5 });
const ROD_MAT = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.4, metalness: 0.7 });
const HEAD_MAT = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.5, metalness: 0.4 });
const ANT_MAT = new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.8 });

/**
 * 3D IoT Temperature & Humidity Sensor on the factory floor with animated heat aura.
 * Defaults safe ("normal") sensors to a sleek compact pill so machines aren't obstructed,
 * while automatically expanding Warning / Heat Hazard sensors into full alert cards.
 */
const SensorMarker = memo(function SensorMarker({
  sensor,
  isJa,
  selected,
  onSelect,
  showInfo = false,
  editMode = false,
  isDragging = false,
  onStartDrag,
}) {
  const {
    id,
    deviceId,
    pos = [0, 0],
    radius = 3.0,
    temperature = 24.5,
    humidity = 50,
    wbgt = null,
    status = "normal",
    isDanger = false,
  } = sensor;

  const markerId = id || deviceId;

  // null = follow automatic rule (expand if showInfo is on OR sensor is warning/danger)
  // true = user manually expanded this sensor; false = user manually collapsed this sensor
  const [userExpanded, setUserExpanded] = useState(null);

  // Reset manual override whenever the global toolbar info toggle changes
  useEffect(() => {
    setUserExpanded(null);
  }, [showInfo]);

  const displayName = isJa ? (sensor.nameJa || sensor.name) : (sensor.name || sensor.nameJa || markerId);
  const shortName = String(displayName)
    .replace(/^Sensor\s*(\d+)\s*[-–—]\s*/i, "S$1·")
    .replace(/OZ/g, "");
  const color = STATUS_COLOR[status] || STATUS_COLOR.normal;
  const autoExpand = showInfo || isDanger || status === "warning";
  const isCardVisible = userExpanded !== null ? userExpanded : autoExpand;

  const startSensorDrag = (e) => {
    if (!editMode || !onStartDrag) return;
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    onStartDrag("sensor", markerId);
  };

  return (
    <group position={[pos[0], 0, pos[1]]}>
      {/* ── Floor Heat Aura (Always visible and emitting colored heat) ── */}
      <SensorHeatAura radius={radius} status={status} isDanger={isDanger} />

      {/* ── Edit Mode Floor Ring Anchor ── */}
      {editMode && (
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={RING_GEO}>
          <meshBasicMaterial color={isDragging ? "#fbbf24" : "#f59e0b"} depthWrite={false} />
        </mesh>
      )}

      {/* ── 3D Sensor Node Hardware on the Floor (Draggable in edit mode) ── */}
      <group
        position={[0, 0, 0]}
        onPointerDown={startSensorDrag}
      >
        {/* Base disc */}
        <mesh position={[0, 0.04, 0]} geometry={BASE_GEO} material={BASE_MAT} />
        {/* Support rod */}
        <mesh position={[0, 0.32, 0]} geometry={ROD_GEO} material={ROD_MAT} />
        {/* Sensor enclosure head */}
        <mesh position={[0, 0.65, 0]} geometry={HEAD_GEO} material={HEAD_MAT} />
        {/* Status LED emitter disc */}
        <mesh position={[0, 0.82, 0]} geometry={LED_GEO}>
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        {/* Antenna */}
        <mesh position={[0.07, 0.95, 0]} geometry={ANT_GEO} material={ANT_MAT} />
      </group>

      {/* ── Floating 3D HUD (Compact vs Detailed view to avoid blocking UI) ── */}
      <Html position={[0, 1.18, 0]} center zIndexRange={[35, 10]}>
        {isCardVisible ? (
          /* Full Detailed Card */
          <div
            className={`twin-sensor-badge ${isDanger ? "twin-sensor-badge--danger" : ""} ${selected ? "twin-sensor-badge--selected" : ""} ${editMode ? "twin-sensor-pill--editable" : ""} ${isDragging ? "twin-sensor-badge--dragging" : ""}`}
            style={{ "--sensor-color": color }}
            onPointerDown={startSensorDrag}
            onClick={() => !editMode && onSelect && onSelect(markerId)}
          >
            {/* Header with minimize button */}
            <div className="twin-sensor-badge__header">
              <span className="material-symbols-outlined twin-sensor-badge__icon">
                {isDanger ? "warning" : "thermostat"}
              </span>
              <span className="twin-sensor-badge__title">{displayName}</span>
              <button
                type="button"
                className="twin-sensor-badge__close-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setUserExpanded(false);
                }}
                title={isJa ? "詳細を最小化 (熱オーラは維持)" : "Minimize details"}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>remove</span>
              </button>
            </div>

            {/* Telemetry metrics */}
            <div className="twin-sensor-badge__readings">
              <span className="twin-sensor-badge__temp">{temperature}°C</span>
              <span className="twin-sensor-badge__humid">{humidity}% RH</span>
            </div>

            {/* Status pill (highlighting safety for workers) */}
            <div className={`twin-sensor-badge__tag twin-sensor-badge__tag--${status}`}>
              {isDanger ? (
                <>
                  <span className="twin-sensor-badge__dot pulse" />
                  <span>{isJa ? `熱中症警戒 ${wbgt ? `(${wbgt}°C)` : ""}` : `HEAT HAZARD ${wbgt ? `(${wbgt}°C)` : ""}`}</span>
                </>
              ) : status === "warning" ? (
                <span>{isJa ? `高温注意 ${wbgt ? `(WBGT ${wbgt}°C)` : ""}` : `Warm / Caution ${wbgt ? `(WBGT ${wbgt}°C)` : ""}`}</span>
              ) : (
                <span>{isJa ? "快適・安全" : "Comfortable"}</span>
              )}
            </div>

            {/* Edit Mode Drag Handle */}
            {editMode && (
              <div
                className={`twin-edit-drag-pill ${isDragging ? "is-dragging" : ""}`}
                onPointerDown={startSensorDrag}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>drag_indicator</span>
                <span>{isJa ? "ドラッグして移動" : "Drag to move"}</span>
              </div>
            )}
          </div>
        ) : (
          /* Sleek Minimalist Pill (Takes almost no screen space, doesn't block machines) */
          <button
            type="button"
            onPointerDown={startSensorDrag}
            onClick={(e) => {
              if (editMode) return;
              e.stopPropagation();
              setUserExpanded(true);
            }}
            className={`twin-sensor-pill ${isDanger ? "twin-sensor-pill--danger" : ""} ${editMode ? "twin-sensor-pill--editable" : ""} ${isDragging ? "twin-sensor-badge--dragging" : ""}`}
            style={{ "--sensor-color": color }}
            title={editMode ? (isJa ? "ドラッグして移動" : "Drag to move") : (isJa ? `${displayName}: ${temperature}°C / ${humidity}% (クリックで詳細表示)` : `${displayName}: ${temperature}°C / ${humidity}% (Click to expand)`)}
          >
            <span className="material-symbols-outlined twin-sensor-pill__icon">
              {editMode ? "drag_indicator" : (isDanger ? "warning" : "thermostat")}
            </span>
            <span className="twin-sensor-pill__name">{shortName}</span>
            <span className="twin-sensor-pill__temp">{temperature}°C</span>
            {isDanger && !editMode && <span className="twin-sensor-pill__dot" />}
          </button>
        )}
      </Html>
    </group>
  );
});

export default SensorMarker;
