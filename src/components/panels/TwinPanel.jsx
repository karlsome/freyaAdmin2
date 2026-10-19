import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { STATUS_THEME, statusLabel } from "../twin/twinTheme";
import FloorPlan2D from "./FloorPlan2D";
import { useFactorySensors } from "../../hooks/useFactorySensors";
import { useFactoryCallMonitor } from "../../hooks/useFactoryCallMonitor";
import StopCallMonitorModal from "../twin/StopCallMonitorModal";
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
 * Supports interactive location editing for sensors, cameras, and the 3D Call Monitor TV.
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
  const [showSensorInfo, setShowSensorInfo] = useState(false);
  const [showCameras, setShowCameras] = useState(false);
  const [showCallMonitor, setShowCallMonitor] = useState(true);
  const [callMonitorModalOpen, setCallMonitorModalOpen] = useState(false);
  const [liteMode, setLiteMode] = useState(() => {
    try {
      return localStorage.getItem("freya_twin_lite_mode") === "1";
    } catch {
      return false;
    }
  });
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCloudToast, setSavedCloudToast] = useState(false);

  const toggleLiteMode = () => {
    setLiteMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("freya_twin_lite_mode", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [localSensors, setLocalSensors] = useState(null);
  const [localCameras, setLocalCameras] = useState(null);
  const [localMonitor, setLocalMonitor] = useState(null);
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;

  const { sensors: factorySensors } = useFactorySensors(factory);
  const {
    activeCalls,
    callsByMachine,
    liveMachines,
    isConnected: isCallStreamConnected,
    now: callNow,
    hasSimulatedCalls,
    toggleSimulatedCall,
    clearSimulatedCalls,
    loadDemoPreset,
  } = useFactoryCallMonitor(factory);

  const annotations = useMemo(() => getFactoryAnnotations(factory), [factory]);
  const defaultCameras = annotations.cameras || [];
  const defaultMonitor = annotations.callMonitor || null;

  // Sync annotations from permanent MongoDB backend on mount and factory change
  useEffect(() => {
    let active = true;
    syncFactoryAnnotations(factory).then((data) => {
      if (active && data && !editModeRef.current) {
        if (Array.isArray(data.cameras) && data.cameras.length > 0) {
          setLocalCameras(data.cameras);
        }
        if (Array.isArray(data.sensors) && data.sensors.length > 0) {
          setLocalSensors(data.sensors);
        }
        if (data.callMonitor) {
          setLocalMonitor(data.callMonitor);
        }
      }
    });

    const onAnnotationsChanged = (e) => {
      if (
        !editModeRef.current &&
        e.detail?.source === "cloud" &&
        (!e.detail.factoryName || e.detail.factoryName === factory)
      ) {
        if (e.detail.payload?.cameras) setLocalCameras(e.detail.payload.cameras);
        if (e.detail.payload?.sensors) setLocalSensors(e.detail.payload.sensors);
        if (e.detail.payload?.callMonitor) setLocalMonitor(e.detail.payload.callMonitor);
      }
    };
    window.addEventListener("freya:annotations-changed", onAnnotationsChanged);

    return () => {
      active = false;
      window.removeEventListener("freya:annotations-changed", onAnnotationsChanged);
    };
  }, [factory]);

  // Merge live sensor telemetry (`factorySensors`) with any local/cloud position overrides (`localSensors`)
  const effectiveSensors = useMemo(() => {
    if (!localSensors || localSensors.length === 0) return factorySensors;
    if (!factorySensors || factorySensors.length === 0) return localSensors;
    return factorySensors.map((s) => {
      const sKey = s.deviceId || s.id;
      const override = localSensors.find(
        (ls) => ls && (ls.deviceId === sKey || ls.id === sKey || ls.deviceId === s.id || ls.id === s.deviceId)
      );
      if (!override) return s;
      const pos = Array.isArray(override.pos)
        ? override.pos
        : Array.isArray(override.position)
          ? override.position
          : s.pos;
      return {
        ...s,
        pos,
        radius: override.radius ?? s.radius,
      };
    });
  }, [localSensors, factorySensors]);

  const effectiveCameras = useMemo(() => {
    const baseList =
      defaultCameras && defaultCameras.length > 0 ? defaultCameras : localCameras || [];
    if (!localCameras || localCameras.length === 0) {
      return baseList.map((c) => {
        const canonicalId = c.streamId || c.id;
        const pos = Array.isArray(c.pos)
          ? c.pos
          : Array.isArray(c.position)
            ? c.position
            : [0, 0];
        return { ...c, id: canonicalId, streamId: canonicalId, pos };
      });
    }
    return baseList.map((c, idx) => {
      const canonicalId = c.streamId || c.id;
      const override =
        localCameras.find(
          (lc) =>
            lc &&
            (lc.streamId === canonicalId ||
              lc.id === canonicalId ||
              lc.id === c.id ||
              lc.streamId === c.id)
        ) || localCameras[idx];
      if (!override) {
        return { ...c, id: canonicalId, streamId: canonicalId };
      }
      const pos = Array.isArray(override.pos)
        ? override.pos
        : Array.isArray(override.position)
          ? override.position
          : c.pos;
      return {
        ...c,
        ...override,
        id: canonicalId,
        streamId: canonicalId,
        pos,
      };
    });
  }, [localCameras, defaultCameras]);

  const effectiveMonitor = useMemo(() => {
    if (!defaultMonitor) return localMonitor;
    if (!localMonitor) return defaultMonitor;
    const pos = Array.isArray(localMonitor.pos)
      ? localMonitor.pos
      : Array.isArray(localMonitor.position)
        ? localMonitor.position
        : defaultMonitor.pos;
    return {
      ...defaultMonitor,
      ...localMonitor,
      pos,
    };
  }, [localMonitor, defaultMonitor]);

  const latestSensorsRef = useRef(effectiveSensors);
  latestSensorsRef.current = effectiveSensors;
  const latestCamerasRef = useRef(effectiveCameras);
  latestCamerasRef.current = effectiveCameras;
  const latestMonitorRef = useRef(effectiveMonitor);
  latestMonitorRef.current = effectiveMonitor;

  const handleUpdatePosition = (type, id, pos) => {
    if (type === "sensor") {
      setLocalSensors(() => {
        const base = latestSensorsRef.current;
        const updated = base.map((s) =>
          s.id === id || s.deviceId === id ? { ...s, pos, position: pos } : s
        );
        latestSensorsRef.current = updated;
        return updated;
      });
    } else if (type === "camera") {
      setLocalCameras(() => {
        const base = latestCamerasRef.current;
        const updated = base.map((c) =>
          c.id === id || c.streamId === id ? { ...c, pos, position: pos } : c
        );
        latestCamerasRef.current = updated;
        return updated;
      });
    } else if (type === "monitor") {
      setLocalMonitor((prev) => {
        const base = prev || latestMonitorRef.current || defaultMonitor;
        const updated = { ...base, pos, position: pos };
        latestMonitorRef.current = updated;
        return updated;
      });
    }
  };

  const handleUpdateMonitorHeight = (newHeight, commitImmediately = false) => {
    setLocalMonitor((prev) => {
      const base = prev || latestMonitorRef.current || defaultMonitor;
      const updated = { ...base, height: newHeight };
      latestMonitorRef.current = updated;
      if (commitImmediately) {
        saveFactoryAnnotations(factory, {
          sensors: latestSensorsRef.current,
          cameras: latestCamerasRef.current,
          callMonitor: updated,
        });
      }
      return updated;
    });
  };

  const handleRotateCamera = (id, newRotationY) => {
    setLocalCameras(() => {
      const base = latestCamerasRef.current;
      const updated = base.map((c) =>
        c.id === id || c.streamId === id ? { ...c, rotationY: newRotationY } : c
      );
      latestCamerasRef.current = updated;
      saveFactoryAnnotations(factory, {
        sensors: latestSensorsRef.current,
        cameras: updated,
        callMonitor: latestMonitorRef.current,
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
        callMonitor: latestMonitorRef.current,
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
    setLocalMonitor(null);
  };

  const handleToggleEditMode = () => {
    setEditMode((prev) => {
      const next = !prev;
      if (next) {
        setShowSensors(true);
        setShowCameras(true);
        setShowCallMonitor(true);
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
                ? "位置編集モード: センサー・カメラ・呼出モニターTVをドラッグで移動（TVは高さ↕も調整可）"
                : "Edit Mode: Drag sensors, cameras & Call Monitor TV (adjust TV height with ↕)"}
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
            callMonitor={effectiveMonitor}
            activeCalls={activeCalls}
            callsByMachine={callsByMachine}
            liveMachines={liveMachines}
            isCallStreamConnected={isCallStreamConnected}
            onSelectCamera={onOpenCamera}
            onOpenCallMonitor={() => setCallMonitorModalOpen(true)}
            showSensors={showSensors}
            showCameras={showCameras}
            showCallMonitor={showCallMonitor}
            showSensorInfo={showSensorInfo}
            liteMode={liteMode}
            onAutoLite={() => setLiteMode(true)}
            editMode={editMode}
            onUpdatePosition={handleUpdatePosition}
            onUpdateMonitorHeight={handleUpdateMonitorHeight}
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

      {/* Needs attention & Active Call chips */}
      <div className="twin-overlay dash-twin__chips">
        {/* Live Stop-Call / Box / Material Request Chips */}
        {activeCalls.map((c) => {
          const shortType = c.leader
            ? isJa
              ? "リーダー呼出"
              : "LEADER"
            : c.stop
              ? isJa
                ? "停止待ち"
                : "STOP"
              : c.box
                ? isJa
                  ? "空箱 📦"
                  : "BOX 📦"
                : isJa
                  ? "部材 🧻"
                  : "ROLL 🧻";
          return (
            <button
              key={`call-chip-${c.machine}`}
              type="button"
              className="twin-chip twin-chip--call"
              style={{ "--status": c.theme.color }}
              onClick={() => onSelect(c.machine)}
              title={isJa ? `クリックして ${c.machine} にフォーカス` : `Click to focus ${c.machine}`}
            >
              <span className="material-symbols-outlined">{c.theme.icon}</span>
              <span>#{c.rank} {c.machine.replace(/^OZ/, "")}</span>
              <small>{shortType} · {c.waitFormatted}</small>
            </button>
          );
        })}

        {activeCalls.length === 0 && attention.length === 0 && hasData && (
          <div className="twin-chip" style={{ "--status": STATUS_THEME.running.color, cursor: "default" }}>
            <span className="material-symbols-outlined">check_circle</span>
            {isJa ? "異常なし" : "All clear"}
          </div>
        )}
        {attention
          .filter((a) => !callsByMachine[a.id])
          .slice(0, Math.max(1, 5 - activeCalls.length))
          .map((a) => (
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

      {/* Overlay controls: Toggles for Call Monitor TV, Sensors/Heat Auras, Sensor Info, Cameras, Location Edit, Lite Mode + Reset view */}
      {has3D && (
        <div className="twin-overlay top-3 right-3 flex items-center gap-1.5">
          {/* Open Call Monitor Modal + 3D Simulator button */}
          <button
            type="button"
            className={`twin-call-tv-btn ${activeCalls.length > 0 ? "is-alert" : ""}`}
            onClick={() => setCallMonitorModalOpen(true)}
            title={isJa ? "呼び出しモニターTV & 3Dテストを開く" : "Open Stop-Call Monitor TV & 3D Call Tester"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>live_tv</span>
            <span className="hidden sm:inline">{isJa ? "呼出モニター" : "Call Monitor"}</span>
            {activeCalls.length > 0 && (
              <span className="twin-call-tv-btn__badge">{activeCalls.length}</span>
            )}
          </button>

          {/* Toggle 3D Call Monitor TV visibility */}
          <button
            type="button"
            className={`twin-icon-btn ${showCallMonitor ? "is-on" : ""}`}
            onClick={() => setShowCallMonitor((v) => !v)}
            title={isJa ? "3D呼出モニターTV表示 切替" : "Toggle 3D Call Monitor TV in scene"}
            aria-label="Toggle 3D Call Monitor TV"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>tv</span>
          </button>

          {/* Location edit mode toggle */}
          <button
            type="button"
            className={`twin-icon-btn ${editMode ? "is-on is-amber" : ""}`}
            onClick={handleToggleEditMode}
            title={isJa ? "カメラ・センサー・モニターの位置編集モード" : "Edit Locations (Drag to reposition)"}
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
                info
              </span>
            </button>
          )}
          <button
            type="button"
            className={`twin-icon-btn ${showCameras ? "is-on" : ""}`}
            onClick={() => setShowCameras((v) => !v)}
            title={
              isJa
                ? (showCameras ? "ライブカメラ3D画面を非表示 (カメラスタンド・アイコンは維持)" : "すべてのライブカメラ3D画面を表示")
                : (showCameras ? "Hide 3D camera screens (keep camera stands & icons)" : "Show all 3D camera screens")
            }
            aria-label={isJa ? "ライブカメラ 3D画面表示 切替" : "Toggle CCTV Camera Screens"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>videocam</span>
          </button>
          <button
            type="button"
            className={`twin-icon-btn ${liteMode ? "is-on" : ""}`}
            onClick={toggleLiteMode}
            title={isJa ? (liteMode ? "軽量モード: オン (低スペックPC向け・影オフ)" : "軽量モード: オフ (クリックで軽量化)") : (liteMode ? "Lite Mode: ON (Low-spec PC optimized)" : "Lite Mode: OFF (Click for low-spec PC optimization)")}
            aria-label="Toggle Lite 3D Performance Mode"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bolt</span>
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

      {/* Full Stop-Call Monitor TV Modal */}
      {callMonitorModalOpen && (
        <StopCallMonitorModal
          factory={factory}
          activeCalls={activeCalls}
          callsByMachine={callsByMachine}
          liveMachines={liveMachines}
          machinesById={machinesById}
          isConnected={isCallStreamConnected}
          now={callNow}
          isJa={isJa}
          hasSimulatedCalls={hasSimulatedCalls}
          onToggleSimulatedCall={toggleSimulatedCall}
          onClearSimulatedCalls={clearSimulatedCalls}
          onLoadDemoPreset={loadDemoPreset}
          onSelectMachine={onSelect}
          onClose={() => setCallMonitorModalOpen(false)}
        />
      )}
    </div>
  );
}
