import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Hls from "hls.js";
import { Html } from "./HtmlOverlay";
import { BASE_URL } from "../../services/api";

const PREVIEW_MIN_W = 110;
const PREVIEW_MAX_W = 540;
const PREVIEW_DEFAULT_W = 176;
const PREVIEW_PRESETS = [136, 220, 320, 440];

// Shared static geometries & materials across all CCTV cameras
const FOV_GEO = (() => {
  const shape = new THREE.Shape();
  const len = 3.6;
  const halfAngle = Math.PI / 6; // 30 deg
  shape.moveTo(0, 0);
  shape.lineTo(len * Math.sin(-halfAngle), len * Math.cos(-halfAngle));
  shape.absarc(0, 0, len, Math.PI / 2 - halfAngle, Math.PI / 2 + halfAngle, false);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 12);
})();
const FOV_MAT = new THREE.MeshBasicMaterial({
  color: "#38bdf8",
  transparent: true,
  opacity: 0.13,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const RING_GEO = new THREE.RingGeometry(0.38, 0.5, 20);
const STAND_BASE_GEO = new THREE.CylinderGeometry(0.16, 0.21, 0.045, 12);
const STAND_RING_GEO = new THREE.RingGeometry(0.22, 0.27, 16);
const POLE_GEO = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8);
const SWIVEL_GEO = new THREE.SphereGeometry(0.07, 8, 8);
const BODY_GEO = new THREE.BoxGeometry(0.18, 0.14, 0.36);
const LENS_BARREL_GEO = new THREE.CylinderGeometry(0.065, 0.065, 0.08, 10);
const LENS_GLASS_GEO = new THREE.CircleGeometry(0.05, 10);
const TALLY_GEO = new THREE.SphereGeometry(0.015, 6, 6);

const STAND_BASE_MAT = new THREE.MeshStandardMaterial({ color: "#1e293b", metalness: 0.6, roughness: 0.4 });
const STAND_RING_MAT = new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
const POLE_MAT = new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.7, roughness: 0.3 });
const SWIVEL_MAT = new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.8 });
const BODY_MAT = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.3 });
const LENS_BARREL_MAT = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.2, metalness: 0.9 });
const LENS_GLASS_MAT = new THREE.MeshBasicMaterial({ color: "#0284c7" });
const TALLY_MAT = new THREE.MeshBasicMaterial({ color: "#ef4444", toneMapped: false });

/**
 * 3D CCTV Camera stand with a clickable camera icon badge (default) and expandable/resizable 3D live monitor.
 * The physical 3D stand and camera icon remain visible at all times so users can click them anytime.
 */
const CameraMarker = memo(function CameraMarker({
  camera,
  isJa,
  showScreen = false,
  onSelectCamera,
  editMode = false,
  isDragging = false,
  onStartDrag,
  onRotateCamera,
}) {
  const { id, streamId = id, pos = [0, 0], rotationY = 0, label, labelJa } = camera;
  const markerId = id || streamId;
  const storageKey = `freya_cam_preview_w_${markerId}`;
  const [videoEl, setVideoEl] = useState(null);

  const [streamError, setStreamError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [minimized, setMinimized] = useState(!showScreen);
  const [isResizing, setIsResizing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey) || localStorage.getItem("freya_cam_preview_w_default"));
      if (Number.isFinite(saved) && saved >= PREVIEW_MIN_W && saved <= PREVIEW_MAX_W) {
        return saved;
      }
    } catch {
      // ignore
    }
    return PREVIEW_DEFAULT_W;
  });
  const justResizedRef = useRef(false);

  // Sync with global toolbar toggle while still allowing individual cameras to be clicked open/closed
  useEffect(() => {
    setMinimized(!showScreen);
  }, [showScreen]);

  const title = isJa ? (labelJa || label) : (label || labelJa || markerId);
  const shortTag = String(title).split("(")[0].trim() || markerId;
  const previewHeight = Math.round(previewWidth * 0.5625);

  const persistWidth = (w) => {
    try {
      localStorage.setItem(storageKey, String(w));
      localStorage.setItem("freya_cam_preview_w_default", String(w));
    } catch {
      // ignore
    }
  };

  const handleCyclePresetSize = (e) => {
    e.stopPropagation();
    const next = PREVIEW_PRESETS.find((p) => p > previewWidth + 12) || PREVIEW_PRESETS[0];
    setPreviewWidth(next);
    persistWidth(next);
  };

  const handleStartResize = (e) => {
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = previewWidth;
    justResizedRef.current = true;
    setIsResizing(true);

    let latestW = startW;
    const onMove = (moveEvt) => {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;
      // Since the card is horizontally centered on the 3D anchor, dragging right/down grows width proportionally
      const deltaW = Math.abs(dx) >= Math.abs(dy) ? dx * 1.8 : dy * (16 / 9) * 1.4;
      latestW = Math.round(Math.max(PREVIEW_MIN_W, Math.min(PREVIEW_MAX_W, startW + deltaW)));
      setPreviewWidth(latestW);
    };

    const onUp = () => {
      setIsResizing(false);
      persistWidth(latestW);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setTimeout(() => {
        justResizedRef.current = false;
      }, 120);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // Connect live HLS video to the mini 3D monitor once the <video> DOM element mounts
  useEffect(() => {
    if (minimized || !videoEl) return undefined;

    setStreamError(false);
    setIsPlaying(false);

    const camBase = import.meta.env.VITE_CAM_URL || BASE_URL;
    const src = `${camBase}api/cam?stream=${streamId}`;
    const camUser = import.meta.env.VITE_CAM_USER || "";
    const camPass = import.meta.env.VITE_CAM_PASS || "";
    const basicAuth = camUser ? "Basic " + btoa(`${camUser}:${camPass}`) : "";

    let hls = null;
    if (Hls.isSupported()) {
      hls = new Hls({
        xhrSetup: (xhr) => {
          if (basicAuth) xhr.setRequestHeader("Authorization", basicAuth);
        },
        capLevelToPlayerSize: true,
        maxBufferLength: 6,
        maxMaxBufferLength: 12,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        lowLatencyMode: false,
        liveBackBufferLength: 0,
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setStreamError(true);
            hls.destroy();
          }
        }
      });

      hls.loadSource(src);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      });
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = src;
      videoEl
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setStreamError(true));
    } else {
      setStreamError(true);
    }

    const onVisibilityChange = () => {
      if (!hls) return;
      if (document.visibilityState === "hidden") {
        hls.stopLoad();
      } else {
        hls.startLoad();
        videoEl.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (hls) hls.destroy();
    };
  }, [videoEl, streamId, minimized]);

  const startCameraDrag = (e) => {
    if (!editMode || !onStartDrag) return;
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    onStartDrag("camera", markerId);
  };

  const handleOpenModal = (e) => {
    e?.stopPropagation && e.stopPropagation();
    if (editMode || justResizedRef.current) return; // Don't open modal in edit mode or right after resizing
    if (onSelectCamera) onSelectCamera(streamId);
  };

  const handleStandClick = (e) => {
    e.stopPropagation();
    if (editMode) return;
    setMinimized((prev) => !prev);
  };

  return (
    <group position={[pos[0], 0, pos[1]]}>
      {/* ── Floor FOV Projection Cone (shown when camera screen is open, hovered, or in edit mode) ── */}
      {(!minimized || isHovered || editMode) && (
        <mesh
          rotation={[-Math.PI / 2, 0, -rotationY]}
          position={[0, 0.012, 0]}
          geometry={FOV_GEO}
          material={FOV_MAT}
          renderOrder={1}
        />
      )}

      {/* ── Edit Mode Floor Ring Anchor ── */}
      {editMode && (
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={RING_GEO}>
          <meshBasicMaterial color={isDragging ? "#38bdf8" : "#0284c7"} depthWrite={false} />
        </mesh>
      )}

      {/* ── 3D Camera Stand & Casing (Always visible; clickable to toggle camera feed, draggable in edit mode) ── */}
      <group
        position={[0, 0, 0]}
        rotation={[0, rotationY, 0]}
        onPointerDown={startCameraDrag}
        onClick={handleStandClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setIsHovered(true);
          document.body.style.cursor = editMode ? "grab" : "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setIsHovered(false);
          document.body.style.cursor = "";
        }}
      >
        {/* Stand floor base plate & cyan locator ring */}
        <mesh position={[0, 0.022, 0]} geometry={STAND_BASE_GEO} material={STAND_BASE_MAT} />
        <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={STAND_RING_GEO} material={STAND_RING_MAT} />
        {/* Mount pole */}
        <mesh position={[0, 0.5, 0]} geometry={POLE_GEO} material={POLE_MAT} />
        {/* Swivel bracket */}
        <mesh position={[0, 1.0, 0]} geometry={SWIVEL_GEO} material={SWIVEL_MAT} />
        {/* Camera body angled down */}
        <group position={[0, 1.0, 0.12]} rotation={[Math.PI / 7, 0, 0]}>
          <mesh geometry={BODY_GEO} material={BODY_MAT} />
          {/* Front lens barrel */}
          <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]} geometry={LENS_BARREL_GEO} material={LENS_BARREL_MAT} />
          {/* Glass lens element */}
          <mesh position={[0, 0, 0.24]} geometry={LENS_GLASS_GEO} material={LENS_GLASS_MAT} />
          {/* Tally light LED */}
          <mesh position={[0.06, 0.06, 0.18]} geometry={TALLY_GEO} material={TALLY_MAT} />
        </group>
      </group>

      {/* ── Floating Camera Icon Pin (default) or Resizable 3D Live Surveillance Screen ── */}
      <Html position={[0, minimized ? 1.42 : 1.7, 0]} center zIndexRange={[35, 10]}>
        {!minimized ? (
          <div
            className={`twin-camera-screen ${editMode ? "twin-camera-badge--editable" : ""} ${isDragging ? "twin-camera-screen--dragging" : ""} ${isResizing ? "twin-camera-screen--resizing" : ""}`}
            style={{ width: `${previewWidth}px` }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onPointerDown={startCameraDrag}
            onClick={handleOpenModal}
            title={editMode ? (isJa ? "ドラッグして移動" : "Drag to move") : (isJa ? "クリックで全画面・右下ドラッグでサイズ変更" : "Click for full-screen · Drag corner to resize")}
          >
            {/* Monitor Header */}
            <div className="twin-camera-screen__header">
              <div className="twin-camera-screen__title">
                <span className="material-symbols-outlined twin-camera-screen__icon">videocam</span>
                <span>{title}</span>
              </div>
              <div className="twin-camera-screen__actions">
                {editMode && (
                  <button
                    type="button"
                    className="twin-camera-screen__btn twin-camera-screen__btn--rotate"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onRotateCamera) {
                        const nextRot = Number(((rotationY + Math.PI / 4) % (Math.PI * 2)).toFixed(3));
                        onRotateCamera(markerId, nextRot);
                      }
                    }}
                    title={isJa ? "カメラの向きを45°回転" : "Rotate camera angle (45°)"}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>rotate_right</span>
                  </button>
                )}
                <button
                  type="button"
                  className="twin-camera-screen__btn"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleCyclePresetSize}
                  title={isJa ? "プレビューサイズ切替 (S/M/L/XL)" : "Cycle preview size (S/M/L/XL)"}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>aspect_ratio</span>
                </button>
                <span className="twin-camera-screen__live">
                  <span className="twin-camera-screen__live-dot" />
                  LIVE
                </span>
                <button
                  type="button"
                  className="twin-camera-screen__btn"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMinimized(true);
                  }}
                  title={isJa ? "カメラ画面を閉じる" : "Hide camera screen"}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                </button>
              </div>
            </div>

            {/* Video Viewport Screen */}
            <div className="twin-camera-screen__viewport" style={{ height: `${previewHeight}px` }}>
              <video
                ref={setVideoEl}
                autoPlay
                muted
                playsInline
                onLoadedData={() => setIsPlaying(true)}
                onPlaying={() => {
                  setIsPlaying(true);
                  setStreamError(false);
                }}
                className="twin-camera-screen__video"
                style={{ display: streamError ? "none" : "block" }}
              />

              {/* Standby / Scanning overlay if stream connecting or preview */}
              {(!isPlaying || streamError) && (
                <div className="twin-camera-screen__standby">
                  <div className="twin-camera-screen__scanlines" />
                  <div className="twin-camera-screen__radar" />
                  <div className="twin-camera-screen__standby-text">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sensors</span>
                    <span>{streamError ? (isJa ? "カメラ待機中" : "CAM STANDBY") : (isJa ? "接続中..." : "CONNECTING...")}</span>
                  </div>
                </div>
              )}

              {/* Live size indicator while dragging the resize handle */}
              {isResizing && (
                <div className="twin-camera-screen__size-chip">
                  {previewWidth} × {previewHeight}
                </div>
              )}

              {/* Subtle bottom-left Fullscreen button on hover (keeps video unobstructed) */}
              {!editMode && !isResizing && isHovered && (
                <button
                  type="button"
                  className="twin-camera-screen__expand-pill"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleOpenModal}
                  title={isJa ? "全画面で開く" : "Open full-screen"}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_full</span>
                </button>
              )}

              {/* Bottom-Right Corner Drag Handle to resize preview */}
              {!editMode && (
                <div
                  className="twin-camera-screen__resize-handle"
                  onPointerDown={handleStartResize}
                  onDoubleClick={handleCyclePresetSize}
                  onClick={(e) => e.stopPropagation()}
                  title={isJa ? "ドラッグでサイズ変更 / ダブルクリックでS・M・L切替" : "Drag to resize preview · Double-click to cycle S/M/L"}
                >
                  <span className="twin-camera-screen__resize-grip" />
                </div>
              )}
            </div>

            {/* Edit Mode Drag Handle */}
            {editMode && (
              <div
                className={`twin-edit-drag-pill twin-edit-drag-pill--camera ${isDragging ? "is-dragging" : ""}`}
                onPointerDown={startCameraDrag}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>drag_indicator</span>
                <span>{isJa ? "ドラッグして移動" : "Drag to move"}</span>
              </div>
            )}
          </div>
        ) : (
          /* Compact clickable camera icon badge above the 3D camera stand */
          <button
            type="button"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onPointerDown={startCameraDrag}
            onClick={(e) => {
              if (editMode) return;
              e.stopPropagation();
              setMinimized(false);
            }}
            className={`twin-camera-badge ${editMode ? "twin-camera-badge--editable" : ""} ${isDragging ? "twin-camera-badge--dragging" : ""}`}
            title={editMode ? (isJa ? "ドラッグして移動" : "Drag to move") : (isJa ? `${title} — クリックでライブカメラを表示` : `${title} — Click to open live camera`)}
          >
            <span className="material-symbols-outlined twin-camera-badge__icon">
              {editMode ? "drag_indicator" : "videocam"}
            </span>
            <span className="twin-camera-badge__title">{shortTag}</span>
            {editMode ? (
              <span
                className="twin-camera-screen__btn twin-camera-screen__btn--rotate"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRotateCamera) {
                    const nextRot = Number(((rotationY + Math.PI / 4) % (Math.PI * 2)).toFixed(3));
                    onRotateCamera(markerId, nextRot);
                  }
                }}
                title={isJa ? "カメラの向きを45°回転" : "Rotate camera angle (45°)"}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>rotate_right</span>
              </span>
            ) : (
              <span className="twin-camera-badge__dot" />
            )}
          </button>
        )}
      </Html>
    </group>
  );
});

export default CameraMarker;
