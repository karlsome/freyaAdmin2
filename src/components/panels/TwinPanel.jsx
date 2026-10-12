import { lazy, Suspense, useState } from "react";
import { STATUS_THEME, statusLabel } from "../twin/twinTheme";

// three.js is heavy: load the 3D scene only when this panel is shown
const FactoryScene = lazy(() => import("../twin/FactoryScene"));

const LEGEND_STATUSES = ["running", "idle", "stopCall", "cncCancel", "maintenance", "break", "off"];

/**
 * 3D factory panel: scene + attention chips + overview button + legend.
 * The machine drawer lives on the page so it also works when the 3D panel is hidden.
 */
export default function TwinPanel({
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
}) {
  const [viewKey, setViewKey] = useState(0);

  return (
    <div className="twin-stage dash-twin">
      <Suspense fallback={<div className="twin-loading"><div className="twin-spinner" /></div>}>
        <FactoryScene
          machinesById={machinesById}
          selectedId={selectedId}
          onSelect={onSelect}
          isDark={isDark}
          isJa={isJa}
          viewKey={viewKey}
          drawerCovers={drawerCovers}
        />
      </Suspense>

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

      {/* Reset view */}
      {!selectedId && (
        <div className="twin-overlay top-3 right-3">
          <button
            type="button"
            className="twin-icon-btn"
            onClick={() => setViewKey((k) => k + 1)}
            title={isJa ? "全体表示" : "Overview"}
            aria-label={isJa ? "全体表示" : "Overview"}
          >
            <span className="material-symbols-outlined">zoom_out_map</span>
          </button>
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
