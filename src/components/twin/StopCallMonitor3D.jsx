import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "./HtmlOverlay";
import { CALL_THEMES } from "../../hooks/useFactoryCallMonitor";
import { KOSE_MACHINE_IDS } from "../../data/factoryLayouts/kose";
import { effectiveStatus } from "./twinTheme";

const MIN_TV_HEIGHT = 1.4;
const MAX_TV_HEIGHT = 7.5;

/**
 * 3D Physical Stop-Call Monitor TV (`factory-stopcall-tv.html`) mounted between OZNC01 and OZNC02.
 * Mirrors live calls (`leader`, `stop`, `box`, `material`) and machine status in real time,
 * supports Edit Mode floor dragging + vertical Height (`↕ Y`) adjustment,
 * and opens the full Call Monitor modal when clicked.
 */
const StopCallMonitor3D = memo(function StopCallMonitor3D({
  monitor,
  machineIds = KOSE_MACHINE_IDS,
  activeCalls = [],
  machinesById = {},
  isConnected = false,
  isJa = true,
  onOpenMonitor,
  onSelectMachine,
  editMode = false,
  isDragging = false,
  onStartDrag,
  onUpdateMonitorHeight,
  onCommitPositions,
}) {
  const bezelMatRef = useRef();
  const floorRingRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [heightDragStart, setHeightDragStart] = useState(null);

  const tvHeight = Math.max(MIN_TV_HEIGHT, Math.min(MAX_TV_HEIGHT, Number(monitor?.height) || 3.4));

  // Window-level vertical drag listener for smooth height adjustment in Edit Mode
  useEffect(() => {
    if (!heightDragStart) return undefined;

    const handlePointerMove = (e) => {
      if (!onUpdateMonitorHeight) return;
      const deltaPx = heightDragStart.startY - e.clientY; // dragging UP increases height
      const nextH = Math.max(
        MIN_TV_HEIGHT,
        Math.min(MAX_TV_HEIGHT, Math.round((heightDragStart.startHeight + deltaPx * 0.018) * 20) / 20)
      );
      onUpdateMonitorHeight(nextH);
    };

    const handlePointerUp = () => {
      setHeightDragStart(null);
      if (onCommitPositions) onCommitPositions();
    };

    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [heightDragStart, onUpdateMonitorHeight, onCommitPositions]);

  useFrame(({ clock }) => {
    const hasAlert = activeCalls.length > 0;
    if (!hasAlert) {
      if (bezelMatRef.current && bezelMatRef.current.emissiveIntensity !== 0.65) {
        bezelMatRef.current.emissiveIntensity = 0.65;
      }
      if (floorRingRef.current && floorRingRef.current.scale.x !== 1) {
        floorRingRef.current.scale.set(1, 1, 1);
      }
      return;
    }
    const t = clock.getElapsedTime();
    if (bezelMatRef.current) {
      bezelMatRef.current.emissiveIntensity = 1.4 + Math.sin(t * 7) * 0.9;
    }
    if (floorRingRef.current) {
      const s = 1 + Math.sin(t * 5) * 0.08;
      floorRingRef.current.scale.set(s, s, 1);
    }
  });

  if (!monitor || !Array.isArray(monitor.pos)) return null;

  const [x, z] = monitor.pos;
  const topCall = activeCalls[0] || null;
  const primaryTheme = topCall?.theme || null;
  const activeColor = editMode
    ? "#f59e0b"
    : primaryTheme
      ? primaryTheme.glow
      : "#10b981";

  const handlePointerDown = (e) => {
    if (!editMode) return;
    e.stopPropagation();
    if (onStartDrag) onStartDrag("monitor", monitor.id || "kose_stopcall_tv");
  };

  const handleStartHeightDrag = (e) => {
    if (!editMode) return;
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    setHeightDragStart({ startY: e.clientY, startHeight: tvHeight });
  };

  const stepHeight = (delta, e) => {
    e.stopPropagation();
    if (!onUpdateMonitorHeight) return;
    const nextH = Math.max(
      MIN_TV_HEIGHT,
      Math.min(MAX_TV_HEIGHT, Math.round((tvHeight + delta) * 20) / 20)
    );
    onUpdateMonitorHeight(nextH, true);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (editMode) return;
    if (onOpenMonitor) onOpenMonitor();
  };

  const poleHeight = Math.max(0.5, tvHeight - 0.12);

  return (
    <group position={[x, 0, z]} rotation={[0, monitor.rotationY || 0, 0]}>
      {/* Floor footprint indicator & support stanchions */}
      <mesh
        ref={floorRingRef}
        position={[0, 0.018, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
      >
        <ringGeometry args={[editMode ? 0.48 : 0.28, editMode ? 0.74 : 0.4, 24]} />
        <meshBasicMaterial
          color={activeColor}
          transparent
          opacity={editMode || isDragging ? 0.9 : hovered ? 0.75 : 0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Dual vertical support truss columns scaling dynamically up to tvHeight */}
      {[-0.55, 0.55].map((dx) => (
        <mesh
          key={dx}
          position={[dx, poleHeight / 2, -0.08]}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
        >
          <cylinderGeometry args={[0.03, 0.04, poleHeight, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Crossbar truss */}
      <mesh position={[0, tvHeight - 0.12, -0.08]}>
        <boxGeometry args={[1.35, 0.05, 0.05]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* 3D Widescreen Industrial TV Chassis */}
      <group
        position={[0, tvHeight, 0]}
        rotation={[0.14, 0, 0]}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = editMode ? "grab" : "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = "";
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[1.85, 1.04, 0.08]} />
          <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.35} />
        </mesh>

        {/* Glowing LED Status Bezel around the 3D TV */}
        <mesh position={[0, 0, 0.042]}>
          <planeGeometry args={[1.78, 0.97]} />
          <meshStandardMaterial
            ref={bezelMatRef}
            color={activeColor}
            emissive={activeColor}
            emissiveIntensity={0.65}
            toneMapped={false}
          />
        </mesh>

        {/* Dark glass screen face */}
        <mesh position={[0, 0, 0.045]}>
          <planeGeometry args={[1.7, 0.9]} />
          <meshBasicMaterial color="#070b14" />
        </mesh>

        {/* Top status beacon bar on TV frame */}
        <mesh position={[0, 0.55, 0.02]}>
          <boxGeometry args={[0.6, 0.045, 0.045]} />
          <meshBasicMaterial color={activeColor} toneMapped={false} />
        </mesh>
      </group>

      {/* Interactive 3D HTML Mini Call-Monitor Screen */}
      <Html
        position={[0, tvHeight, 0.08]}
        center
        zIndexRange={[32, 12]}
        style={{
          pointerEvents: "auto",
        }}
      >
        <div
          className={`twin-tv-card ${activeCalls.length > 0 ? "twin-tv-card--alert" : ""} ${editMode ? "twin-tv-card--editable" : ""} ${(isDragging || heightDragStart) ? "twin-tv-card--dragging" : ""}`}
          style={{ "--tv-accent": activeColor }}
          onPointerDown={(e) => {
            if (!editMode) return;
            e.stopPropagation();
            if (onStartDrag) onStartDrag("monitor", monitor.id || "kose_stopcall_tv");
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (editMode) return;
            if (onOpenMonitor) onOpenMonitor();
          }}
          title={
            editMode
              ? isJa
                ? "ドラッグして平面移動・下のバーで高さ調整"
                : "Drag to move on floor, or use height bar below"
              : isJa
                ? "クリックして呼出モニターを拡大表示"
                : "Click to expand Call Monitor TV"
          }
        >
          {/* TV Header */}
          <div className="twin-tv-card__header">
            <span className="twin-tv-card__title">
              <span className={`twin-tv-card__dot ${isConnected ? "is-online" : ""}`} />
              <span>{isJa ? "呼出モニター" : "CALL MONITOR"}</span>
            </span>
            <span className="twin-tv-card__action">
              {activeCalls.length > 0 ? (
                <span className="twin-tv-card__count">{activeCalls.length}</span>
              ) : null}
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
                {editMode ? "open_with" : "open_in_full"}
              </span>
            </span>
          </div>

          {/* TV Body: Either Active Calls Queue OR Mini 19-Machine Status Matrix */}
          {activeCalls.length > 0 ? (
            <div className="twin-tv-card__calls">
              {activeCalls.slice(0, 2).map((c) => {
                const shortName = String(c.machine).replace(/^OZ/, "");
                const tags = [];
                if (c.leader) tags.push({ label: "CALL", bg: CALL_THEMES.leader.color });
                if (c.stop) tags.push({ label: "STOP", bg: CALL_THEMES.stop.color });
                if (c.box) tags.push({ label: "BOX", bg: CALL_THEMES.box.color });
                if (c.material) {
                  tags.push({
                    label: c.zairyoSebanggo ? `ROLL:${c.zairyoSebanggo}` : "ROLL",
                    bg: CALL_THEMES.material.color,
                  });
                }
                return (
                  <div
                    key={c.machine}
                    className="twin-tv-card__call-row"
                    style={{ "--row-color": c.theme?.color || "#e11d2a" }}
                    onClick={(e) => {
                      if (editMode) return;
                      e.stopPropagation();
                      if (onSelectMachine) onSelectMachine(c.machine);
                    }}
                  >
                    <span className="twin-tv-card__rank">#{c.rank}</span>
                    <span className="twin-tv-card__machine">{shortName}</span>
                    <span className="twin-tv-card__tags">
                      {tags.map((t, i) => (
                        <span key={i} className="twin-tv-card__tag" style={{ background: t.bg }}>
                          {t.label}
                        </span>
                      ))}
                    </span>
                    <span className="twin-tv-card__timer">{c.waitFormatted}</span>
                  </div>
                );
              })}
              {activeCalls.length > 2 && (
                <div className="twin-tv-card__more">
                  +{activeCalls.length - 2} {isJa ? "件" : "more"}
                </div>
              )}
            </div>
          ) : (
            <div className="twin-tv-card__clear">
              <div className="twin-tv-card__mini-grid">
                {machineIds.map((mId) => {
                  const st = effectiveStatus(machinesById[mId]);
                  const dotColor =
                    st === "running"
                      ? "#22c55e"
                      : st === "break"
                        ? "#3b82f6"
                        : st === "maintenance"
                          ? "#a855f7"
                          : st === "stopCall"
                            ? "#ef4444"
                            : "#475569";
                  return (
                    <span
                      key={mId}
                      className="twin-tv-card__mini-cell"
                      style={{ background: dotColor }}
                      title={`${mId}: ${st}`}
                    />
                  );
                })}
              </div>
              <div className="twin-tv-card__clear-text">
                <span className="material-symbols-outlined" style={{ fontSize: 11, color: "#10b981" }}>
                  check_circle
                </span>
                <span>{isJa ? "異常なし / CLEAR" : "ALL CLEAR"}</span>
              </div>
            </div>
          )}

          {/* Edit Mode: Floor Drag + Vertical Height (Y) Adjustment Controls */}
          {editMode && (
            <div className="twin-tv-card__edit-controls" onPointerDown={(e) => e.stopPropagation()}>
              <div
                className="twin-tv-card__height-drag"
                onPointerDown={handleStartHeightDrag}
                title={isJa ? "上下にドラッグして高さを変更" : "Drag up/down to adjust height"}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>height</span>
                <span>{isJa ? "高さ" : "H"}: {tvHeight.toFixed(1)}m</span>
              </div>
              <div className="twin-tv-card__height-btns">
                <button
                  type="button"
                  className="twin-tv-card__hbtn"
                  onClick={(e) => stepHeight(-0.3, e)}
                  title={isJa ? "低くする (-0.3m)" : "Lower (-0.3m)"}
                >
                  −
                </button>
                <button
                  type="button"
                  className="twin-tv-card__hbtn"
                  onClick={(e) => stepHeight(0.3, e)}
                  title={isJa ? "高くする (+0.3m)" : "Raise (+0.3m)"}
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
});

export default StopCallMonitor3D;
