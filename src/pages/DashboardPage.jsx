import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { useDigitalTwin } from "../hooks/useDigitalTwin";
import CameraModal from "../components/CameraModal";
import AICopilotPanel from "../components/dashboard/AICopilotPanel";
import MachineDrawer from "../components/twin/MachineDrawer";
import { KOSE_LAYOUT, KOSE_MACHINE_IDS } from "../data/factoryLayouts/kose";
import {
  ATTENTION_STATUSES,
  STATUS_ORDER,
  STATUS_THEME,
  effectiveStatus,
  formatNumber,
  statusLabel,
} from "../components/twin/twinTheme";
import "../components/twin/twin.css";
import { applyDemo, isDemoMode } from "../components/twin/twinDemo";

// three.js is heavy: load the 3D scene only when the dashboard is opened
const FactoryScene = lazy(() => import("../components/twin/FactoryScene"));

const FACTORY = KOSE_LAYOUT.factory;

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function KpiCard({ icon, label, value, unit, color, progress }) {
  return (
    <div className="twin-kpi" style={{ "--kpi-color": color }}>
      <div className="twin-kpi__icon">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="twin-kpi__label">{label}</div>
        <div className="twin-kpi__value">
          {value}
          {unit && <small>{unit}</small>}
        </div>
        {progress !== undefined && (
          <div className="twin-kpi__bar">
            <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const isDark = useIsDarkMode();
  const navigate = useNavigate();
  const { data: liveData, loading, error, lastRefresh, refresh } = useDigitalTwin(FACTORY);
  const demo = isDemoMode();
  const data = useMemo(() => (demo ? applyDemo(liveData) : liveData), [demo, liveData]);

  const [selectedId, setSelectedId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [viewKey, setViewKey] = useState(0);

  const machinesById = useMemo(() => {
    const map = {};
    (data?.machines || []).forEach((m) => { map[m.id] = m; });
    return map;
  }, [data]);

  // ── Summary over the machines on the floor map ──
  const summary = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
    let pieces = 0;
    KOSE_MACHINE_IDS.forEach((id) => {
      const m = machinesById[id];
      counts[effectiveStatus(m)] += 1;
      pieces += m?.pieces || 0;
    });
    const goal = data?.goal || 0;
    return {
      counts,
      total: KOSE_MACHINE_IDS.length,
      running: counts.running,
      pieces,
      goal,
      goalPct: goal > 0 ? Math.round((pieces / goal) * 100) : null,
    };
  }, [machinesById, data]);

  // ── Machines needing attention (pairs shown once) ──
  const attention = useMemo(() => {
    const seen = new Set();
    const list = [];
    KOSE_MACHINE_IDS.forEach((id) => {
      if (seen.has(id)) return;
      const m = machinesById[id];
      const status = effectiveStatus(m);
      if (!ATTENTION_STATUSES.has(status)) return;
      seen.add(id);
      let label = id;
      if (m?.pair?.together) {
        seen.add(m.pair.partner);
        label = `${id.replace("OZ", "")} ⇄ ${m.pair.partner.replace("OZ", "")}`;
      }
      list.push({ id, label, status });
    });
    return list.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  }, [machinesById]);

  const selected = selectedId ? machinesById[selectedId] || { id: selectedId, status: "off" } : null;
  const selectedPartner = selected?.pair?.together ? machinesById[selected.pair.partner] : null;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setSelectedId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString(isJa ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

  return (
    <section className="w-full h-screen flex flex-col gap-4 pt-20 px-4 sm:px-6 md:px-8 pb-6 overflow-hidden">
      {/* ── Header: title + 3 big numbers + actions ── */}
      <header className="flex flex-col xl:flex-row xl:items-center gap-4">
        <div className="flex items-center gap-3 min-w-[220px]">
          <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 34 }}>factory</span>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] leading-tight">
              {isJa ? `${FACTORY}工場` : `${FACTORY} Factory`}
            </h1>
            <p className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${error ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
              {isJa ? "ライブ" : "Live"} · {refreshLabel}
              {demo && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {isJa ? "プレビュー" : "PREVIEW"}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          <KpiCard
            icon="precision_manufacturing"
            label={isJa ? "稼働中の設備" : "Machines running"}
            value={summary.running}
            unit={`/ ${summary.total}`}
            color={STATUS_THEME.running.color}
            progress={(summary.running / summary.total) * 100}
          />
          <KpiCard
            icon="inventory_2"
            label={isJa ? "本日の生産数" : "Pieces today"}
            value={formatNumber(summary.pieces)}
            unit={isJa ? "個" : "pcs"}
            color="#3b82f6"
          />
          <KpiCard
            icon="flag"
            label={isJa ? "本日の目標達成率" : "Goal today"}
            value={summary.goalPct === null ? "—" : summary.goalPct}
            unit={summary.goalPct === null ? "" : `%  (${formatNumber(summary.goal)})`}
            color="#a855f7"
            progress={summary.goalPct ?? 0}
          />
        </div>

        <div className="flex items-center gap-2 self-end xl:self-center">
          <button
            type="button"
            onClick={refresh}
            className="twin-icon-btn"
            title={isJa ? "更新" : "Refresh"}
            aria-label={isJa ? "更新" : "Refresh"}
          >
            <span className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`}>refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            className={`h-10 px-4 rounded-[12px] border text-sm font-bold flex items-center gap-2 transition-colors ${
              chatOpen
                ? "bg-[var(--freya-blue)] text-white border-[var(--freya-blue)]"
                : "bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>smart_toy</span>
            {isJa ? "AIチャット" : "AI chat"}
          </button>
        </div>
      </header>

      {/* ── Body: 3D twin + collapsible AI chat ── */}
      <div className="flex-1 min-h-0 flex gap-4">
        <div className="twin-stage flex-1 min-w-0 min-h-[420px]">
          <Suspense fallback={<div className="twin-loading"><div className="twin-spinner" /></div>}>
            <FactoryScene
              machinesById={machinesById}
              selectedId={selectedId}
              onSelect={setSelectedId}
              isDark={isDark}
              isJa={isJa}
              viewKey={viewKey}
            />
          </Suspense>

          {/* Needs attention — big tappable chips */}
          <div className="twin-overlay top-3 left-3 flex-wrap max-w-[60%]">
            {attention.length === 0 && data && (
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
                onClick={() => setSelectedId(a.id)}
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
          <div className="twin-overlay bottom-3 left-3">
            <div className="twin-legend">
              {["running", "idle", "stopCall", "cncCancel", "maintenance", "break", "off"].map((s) => (
                <span key={s} className="twin-legend__item" style={{ "--status": STATUS_THEME[s].color }}>
                  <span className="twin-legend__swatch" />
                  {statusLabel(s, isJa)}
                  <b>{summary.counts[s] || 0}</b>
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

          {loading && !data && (
            <div className="twin-loading"><div className="twin-spinner" /></div>
          )}

          <MachineDrawer
            machine={selected}
            partner={selectedPartner}
            isJa={isJa}
            onClose={() => setSelectedId(null)}
            onCamera={() => setCameraOpen(true)}
            onDetails={() => navigate("/factoryStatus")}
          />
        </div>

        {chatOpen && (
          <div className="hidden lg:block w-80 xl:w-96 flex-shrink-0 min-h-0">
            <AICopilotPanel
              currentPersona="plant_operations"
              kpiContext={{ factory: FACTORY, ...summary }}
              onReorderCards={() => {}}
              onReset={() => {}}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>

      {cameraOpen && (
        <CameraModal factory={FACTORY} stream="tapo_cam" onClose={() => setCameraOpen(false)} />
      )}
    </section>
  );
}
