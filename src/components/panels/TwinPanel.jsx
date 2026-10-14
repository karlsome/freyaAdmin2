import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { STATUS_THEME, statusLabel } from "../twin/twinTheme";
import FloorPlan2D from "./FloorPlan2D";
import { useFactorySensors } from "../../hooks/useFactorySensors";
import {
  getFactoryAnnotations,
  saveFactoryAnnotations,
  resetFactoryAnnotations,
  syncFactoryAnnotations,
} from "../../data/factoryLayouts/annotations";

// three.js is heavy: load the 3D scene only when this panel is shown
const FactoryScene = lazy(() => import("../twin/FactoryScene"));

const LEGEND_STATUSES = ["running", "idle", "stopCall", "cncCancel", "maintenance", "break", "off"];

/**
 * Factory panel: 3D scene (or automatic 2D floor for factories without a 3D map)
 * + attention chips + overview button + legend.
 * Supports interactive location editing for sensors and cameras with permanent cloud persistence.
 */
export default function TwinPanel({
  factory = "小瀬",
  machinesById,
  selectedId,
  onSelect,
  isDark,
  isJa,
  attention,
  counts,
  hasData,
  error,
  loading,
  drawerCovers,
  has3D = true,
  units = [],
  hasSensors = true,
  onOpenCamera,
}) {
  const [viewKey, setViewKey] = useState(0);
  const [showSensors, setShowSensors] = useState(true);
  const [showSensorInfo, setShowSensorInfo] = useState(true);
  const [showCameras, setShowCameras] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCloudToast, setSavedCloudToast] = useState(false);

  const [localSensors, setLocalSensors] = useState(null);
  const [localCameras, setLocalCameras] = useState(null);

  const { sensors: factorySensors } = useFactorySensors(factory);
  const annotations = useMemo(() => getFactoryAnnotations(factory), [factory]);
  const defaultCameras = annotations.cameras || [];

  // Sync annotations from permanent MongoDB backend on mount and factory change
  useEffect(() => {
    let active = true;
    syncFactoryAnnotations(factory).then((data) => {
      if (active && data) {
        if (Array.isArray(data.cameras) && data.cameras.length > 0) {
          setLocalCameras(data.cameras);
        }
        if (Array.isArray(data.sensors) && data.sensors.length > 0) {
          setLocalSensors(data.sensors);
        }
      }
    });

    const onAnnotationsChanged = (e) => {
      if (e.detail?.source === "cloud" && (!e.detail.factoryName || e.detail.factoryName === factory)) {
        if (e.detail.payload?.cameras) setLocalCameras(e.detail.payload.cameras);
        if (e.detail.payload?.sensors) setLocalSensors(e.detail.payload.sensors);
      }
    };
    window.addEventListener("freya:annotations-changed", onAnnotationsChanged);

    return () => {
      active = false;
      window.removeEventListener("freya:annotations-changed", onAnnotationsChanged);
    };
  }, [factory]);

  const effectiveSensors = useMemo(() => {
    if (localSensors) return localSensors;
    return factorySensors;
  }, [localSensors, factorySensors]);

  const effectiveCameras = useMemo(() => {
    if (localCameras) return localCameras;
    return defaultCameras;
  }, [localCameras, defaultCameras]);

  const latestSensorsRef = useRef(effectiveSensors);
  latestSensorsRef.current = effectiveSensors;
  const latestCamerasRef = useRef(effectiveCameras);
  latestCamerasRef.current = effectiveCameras;

  const handleUpdatePosition = (type, id, pos) => {
    if (type === "sensor") {
      setLocalSensors((prev) => {
        const base = prev || factorySensors;
        const updated = base.map((s) => (s.id === id ? { ...s, pos } : s));
        latestSensorsRef.current = updated;
        return updated;
      });
    } else if (type === "camera") {
      setLocalCameras((prev) => {
        const base = prev || defaultCameras;
        const updated = base.map((c) => (c.id === id ? { ...c, pos } : c));
        latestCamerasRef.current = updated;
        return updated;
      });
    }
  };

  const handleRotateCamera = (id, newRotationY) => {
    setLocalCameras((prev) => {
      const base = prev || defaultCameras;
      const updated = base.map((c) => (c.id === id ? { ...c, rotationY: newRotationY } : c));
      latestCamerasRef.current = updated;
      saveFactoryAnnotations(factory, {
        sensors: latestSensorsRef.current,
        cameras: updated,
      });
      return updated;
    });
  };

  const handleCommitPositions = async () => {
    setIsSaving(true);
    try {
      await saveFactoryAnnotations(factory, {
        sensors: latestSensorsRef.current,
        cameras: latestCamerasRef.current,
      });
      setSavedCloudToast(true);
      setTimeout(() => setSavedCloudToast(false), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetLocations = async () => {
    await resetFactoryAnnotations(factory);
    setLocalSensors(null);
    setLocalCameras(null);
  };

  const handleToggleEditMode = () => {
    setEditMode((prev) => {
      const next = !prev;
      if (next) {
        setShowSensors(true);
        setShowCameras(true);
      }
      return next;
    });
  };

  return (
    <div className={`twin-stage dash-twin ${has3D ? "" : "dash-twin--2d"} ${editMode ? "twin-stage--editing" : ""}`}>
      {/* ── Edit Location Mode Banner ── */}
      {has3D && editMode && (
        <div className="twin-edit-banner">
          <div className="twin-edit-banner__info">
            <span className="material-symbols-outlined twin-edit-banner__icon">edit_location</span>
            <span>
              {isJa
                ? "位置編集モード: センサーやカメラをドラッグして希望の位置に配置してください"
                : "Edit Mode: Drag sensors and cameras across the floor to position them"}
            </span>
          </div>
          <div className="twin-edit-banner__actions">
            <button
              type="button"
              onClick={handleResetLocations}
              className="twin-edit-btn twin-edit-btn--ghost"
              title={isJa ? "すべての位置を初期配置に戻します" : "Reset to default layout positions"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
              {isJa ? "初期位置に戻す" : "Reset Default"}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={async () => {
                await handleCommitPositions();
                setEditMode(false);
              }}
              className="twin-edit-btn twin-edit-btn--primary"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {isSaving ? "sync" : "cloud_done"}
              </span>
              {isSaving
                ? (isJa ? "保存中..." : "Saving...")
                : (isJa ? "完了・全ユーザーに保存" : "Done & Save for All")}
            </button>
          </div>
        </div>
      )}

      {/* Floating Cloud Save Confirmation Toast */}
      {savedCloudToast && (
        <div className="twin-edit-toast">
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#10b981" }}>cloud_done</span>
          <span>{isJa ? "位置情報を恒久保存しました（全ユーザーに反映）" : "Positions saved permanently to database"}</span>
        </div>
      )}

      {has3D ? (
        <Suspense fallback={<div className="twin-loading"><div className="twin-spinner" /></div>}>
          <FactoryScene
            machinesById={machinesById}
            selectedId={selectedId}
            onSelect={onSelect}
            isDark={isDark}
            isJa={isJa}
            viewKey={viewKey}
            drawerCovers={drawerCovers}
            sensors={effectiveSensors}
            cameras={effectiveCameras}
            onSelectCamera={onOpenCamera}
            showSensors={showSensors}
            showCameras={showCameras}
            showSensorInfo={showSensorInfo}
            editMode={editMode}
            onUpdatePosition={handleUpdatePosition}
            onRotateCamera={handleRotateCamera}
            onCommitPositions={handleCommitPositions}
          />
        </Suspense>
      ) : (
        hasData && (
          <FloorPlan2D
            units={units}
            machinesById={machinesById}
            selectedId={selectedId}
            onSelect={onSelect}
            isJa={isJa}
            hasSensors={hasSensors}
          />
        )
      )}

      {/* Needs attention — big tappable chips */}
      <div className="twin-overlay dash-twin__chips">
        {attention.length === 0 && hasData && (
          <div className="twin-chip" style={{ "--status": STATUS_THEME.running.color, cursor: "default" }}>
            <span className="material-symbols-outlined">check_circle</span>
            {isJa ? "異常なし" : "All clear"}
          </div>
        )}
        {attention.slice(0, 6).map((a) => (
          <button
            key={a.id}
            type="button"
            className="twin-chip"
            style={{ "--status": STATUS_THEME[a.status].color }}
            onClick={() => onSelect(a.id)}
          >
            <span className="material-symbols-outlined">{STATUS_THEME[a.status].icon}</span>
            {a.label}
            <small>{statusLabel(a.status, isJa)}</small>
          </button>
        ))}
        {attention.length > 6 && (
          <div className="twin-chip" style={{ "--status": "#94a3b8", cursor: "default" }}>+{attention.length - 6}</div>
        )}
      </div>

      {/* Overlay controls: Toggles for Sensors/Heat Auras, Sensor Info, Cameras, Location Edit + Reset view */}
      {has3D && (
        <div className="twin-overlay top-3 right-3 flex items-center gap-1.5">
          {/* Location edit mode toggle */}
          <button
            type="button"
            className={`twin-icon-btn ${editMode ? "is-on is-amber" : ""}`}
            onClick={handleToggleEditMode}
            title={isJa ? "カメラ・センサーの位置編集モード (ドラッグして移動)" : "Edit Locations (Drag to reposition)"}
            aria-label="Toggle location edit mode"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {editMode ? "edit_location_alt" : "edit_location"}
            </span>
          </button>

          <button
            type="button"
            className={`twin-icon-btn ${showSensors ? "is-on" : ""}`}
            onClick={() => setShowSensors((v) => !v)}
            title={isJa ? "温湿度センサー & 熱中症オーラ表示 切替" : "Toggle Heat Auras & Sensors"}
            aria-label={isJa ? "温湿度センサー & 熱中症オーラ表示 切替" : "Toggle Heat Auras & Sensors"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>thermostat</span>
          </button>
          {showSensors && (
            <button
              type="button"
              className={`twin-icon-btn ${showSensorInfo ? "is-on" : ""}`}
              onClick={() => setShowSensorInfo((v) => !v)}
              title={isJa ? (showSensorInfo ? "センサー詳細バッジを非表示 (床の熱オーラは維持)" : "センサー詳細バッジを表示") : (showSensorInfo ? "Hide sensor info cards" : "Show sensor info cards")}
              aria-label="Toggle sensor info cards"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {showSensorInfo ? "info" : "info_outline"}
              </span>
            </button>
          )}
          <button
            type="button"
            className={`twin-icon-btn ${showCameras ? "is-on" : ""}`}
            onClick={() => setShowCameras((v) => !v)}
            title={isJa ? "ライブカメラ 3D画面表示 切替" : "Toggle CCTV Cameras"}
            aria-label={isJa ? "ライブカメラ 3D画面表示 切替" : "Toggle CCTV Cameras"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>videocam</span>
          </button>
          {!selectedId && (
            <button
              type="button"
              className="twin-icon-btn"
              onClick={() => setViewKey((k) => k + 1)}
              title={isJa ? "全体表示" : "Overview"}
              aria-label={isJa ? "全体表示" : "Overview"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>zoom_out_map</span>
            </button>
          )}
        </div>
      )}

      {/* Legend with live counts */}
      <div className="twin-overlay bottom-3 left-3 dash-twin__legend">
        <div className="twin-legend">
          {LEGEND_STATUSES.map((s) => (
            <span key={s} className="twin-legend__item" style={{ "--status": STATUS_THEME[s].color }}>
              <span className="twin-legend__swatch" />
              <span className="twin-legend__label">{statusLabel(s, isJa)}</span>
              <b>{counts[s] || 0}</b>
            </span>
          ))}
        </div>
      </div>

      {/* Error banner (keeps last good data visible) */}
      {error && (
        <div className="twin-overlay bottom-3 right-3">
          <div className="twin-chip" style={{ "--status": STATUS_THEME.stopCall.color, cursor: "default" }}>
            <span className="material-symbols-outlined">cloud_off</span>
            {isJa ? "サーバー接続エラー" : "Server unreachable"}
          </div>
        </div>
      )}

      {loading && !hasData && (
        <div className="twin-loading"><div className="twin-spinner" /></div>
      )}
    </div>
  );
}
