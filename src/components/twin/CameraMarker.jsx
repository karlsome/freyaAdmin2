import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import Hls from "hls.js";
import { BASE_URL } from "../../services/api";

/**
 * 3D CCTV Camera with an interactive mini 3D surveillance monitor screen.
 * Displays live video in 3D; clicking the small screen pops up the full-screen CameraModal.
 */
export default function CameraMarker({
  camera,
  isJa,
  onSelectCamera,
  editMode = false,
  isDragging = false,
  onStartDrag,
  onRotateCamera,
}) {
  const { id, streamId = id, pos = [0, 0], rotationY = 0, label, labelJa } = camera;
  const tallyRef = useRef();
  const fovRef = useRef();
  const videoRef = useRef(null);

  const [streamError, setStreamError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const title = isJa ? (labelJa || label) : (label || labelJa || id);

  // Directional FOV projection cone on the floor
  const fovGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const len = 3.6;
    const halfAngle = Math.PI / 6; // 30 deg
    shape.moveTo(0, 0);
    shape.lineTo(len * Math.sin(-halfAngle), len * Math.cos(-halfAngle));
    shape.absarc(0, 0, len, Math.PI / 2 - halfAngle, Math.PI / 2 + halfAngle, false);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (tallyRef.current) {
      tallyRef.current.material.opacity = 0.35 + 0.65 * Math.sin(t * 3.5);
    }
    if (fovRef.current) {
      fovRef.current.material.opacity = 0.11 + 0.04 * Math.sin(t * 2);
    }
  });

  // Connect live HLS video to the mini 3D monitor
  useEffect(() => {
    if (minimized) return;
    const video = videoRef.current;
    if (!video) return;

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
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 6,
        lowLatencyMode: true,
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setStreamError(true);
          hls.destroy();
        }
      });

      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setIsPlaying(true)).catch(() => setStreamError(true));
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.play().then(() => setIsPlaying(true)).catch(() => setStreamError(true));
    } else {
      setStreamError(true);
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [streamId, minimized]);

  const handleOpenModal = (e) => {
    e?.stopPropagation && e.stopPropagation();
    if (editMode) return; // In edit mode, don't open popup modal
    if (onSelectCamera) onSelectCamera(streamId);
  };

  return (
    <group position={[pos[0], 0, pos[1]]}>
      {/* ── Floor FOV Projection Cone ── */}
      <mesh
        ref={fovRef}
        rotation={[-Math.PI / 2, 0, -rotationY]}
        position={[0, 0.012, 0]}
        geometry={fovGeo}
        renderOrder={1}
      >
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.14}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Edit Mode Floor Ring Anchor ── */}
      {editMode && (
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.5, 24]} />
          <meshBasicMaterial color={isDragging ? "#38bdf8" : "#0284c7"} depthWrite={false} />
        </mesh>
      )}

      {/* ── 3D Camera Mount & Casing (Draggable in edit mode) ── */}
      <group
        position={[0, 0, 0]}
        rotation={[0, rotationY, 0]}
        onPointerDown={(e) => {
          if (editMode && onStartDrag) {
            e.stopPropagation();
            onStartDrag("camera", id);
          }
        }}
      >
        {/* Mount pole */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 1.0, 12]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Swivel bracket */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
        {/* Camera body angled down */}
        <group position={[0, 1.0, 0.12]} rotation={[Math.PI / 7, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.18, 0.14, 0.36]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} />
          </mesh>
          {/* Front lens barrel */}
          <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.08, 16]} />
            <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.9} />
          </mesh>
          {/* Glass lens element */}
          <mesh position={[0, 0, 0.24]}>
            <circleGeometry args={[0.05, 16]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>
          {/* Blinking tally light LED */}
          <mesh ref={tallyRef} position={[0.06, 0.06, 0.18]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color="#ef4444" transparent toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* ── Little 3D Surveillance Screen on the Camera ── */}
      <Html position={[0, 1.7, 0]} center zIndexRange={[35, 10]}>
        {!minimized ? (
          <div
            className={`twin-camera-screen ${isDragging ? "twin-camera-screen--dragging" : ""}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleOpenModal}
            title={editMode ? (isJa ? "ドラッグして移動" : "Drag to move") : (isJa ? "クリックで全画面拡大表示" : "Click to open full-screen live feed")}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onRotateCamera) {
                        const nextRot = Number(((rotationY + Math.PI / 4) % (Math.PI * 2)).toFixed(3));
                        onRotateCamera(id, nextRot);
                      }
                    }}
                    title={isJa ? "カメラの向きを45°回転" : "Rotate camera angle (45°)"}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>rotate_right</span>
                  </button>
                )}
                <span className="twin-camera-screen__live">
                  <span className="twin-camera-screen__live-dot" />
                  LIVE
                </span>
                <button
                  type="button"
                  className="twin-camera-screen__btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMinimized(true);
                  }}
                  title={isJa ? "最小化" : "Minimize"}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>remove</span>
                </button>
              </div>
            </div>

            {/* Video Viewport Screen */}
            <div className="twin-camera-screen__viewport">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
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

              {/* Hover overlay hint: click to enlarge (only when not in editMode) */}
              {!editMode && isHovered && (
                <div className="twin-camera-screen__hover-overlay">
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>open_in_full</span>
                  <span>{isJa ? "拡大表示" : "Expand"}</span>
                </div>
              )}
            </div>

            {/* Edit Mode Drag Handle */}
            {editMode && (
              <div
                className={`twin-edit-drag-pill twin-edit-drag-pill--camera ${isDragging ? "is-dragging" : ""}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (onStartDrag) onStartDrag("camera", id);
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>drag_indicator</span>
                <span>{isJa ? "ドラッグして移動" : "Drag to move"}</span>
              </div>
            )}
          </div>
        ) : (
          /* Minimized compact camera pill */
          <button
            type="button"
            onPointerDown={(e) => {
              if (editMode && onStartDrag) {
                e.stopPropagation();
                onStartDrag("camera", id);
              }
            }}
            onClick={(e) => {
              if (editMode) return;
              e.stopPropagation();
              setMinimized(false);
            }}
            className={`twin-camera-badge ${editMode ? "twin-camera-badge--editable" : ""} ${isDragging ? "twin-camera-badge--dragging" : ""}`}
            title={editMode ? (isJa ? "ドラッグして移動" : "Drag to move") : (isJa ? "クリックで3D画面を開く" : "Click to show 3D monitor")}
          >
            <span className="material-symbols-outlined twin-camera-badge__icon">
              {editMode ? "drag_indicator" : "videocam"}
            </span>
            <span className="twin-camera-badge__title">{title}</span>
            {editMode ? (
              <span
                className="twin-camera-screen__btn twin-camera-screen__btn--rotate"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRotateCamera) {
                    const nextRot = Number(((rotationY + Math.PI / 4) % (Math.PI * 2)).toFixed(3));
                    onRotateCamera(id, nextRot);
                  }
                }}
                title={isJa ? "カメラの向きを45°回転" : "Rotate camera angle (45°)"}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>rotate_right</span>
              </span>
            ) : (
              <span className="twin-camera-badge__live">
                <span className="twin-camera-badge__dot" />
                LIVE
              </span>
            )}
          </button>
        )}
      </Html>
    </group>
  );
}
