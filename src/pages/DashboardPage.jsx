import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { useDigitalTwin } from "../hooks/useDigitalTwin";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import { useRecordModal } from "../hooks/useRecordModal";
import CameraModal from "../components/CameraModal";
import RecordDetailModal from "../components/RecordDetailModal";
import AICopilotPanel from "../components/dashboard/AICopilotPanel";
import AIShapeRenderer from "../components/dashboard/AIShapeRenderer";
import MachineDrawer from "../components/twin/MachineDrawer";
import { has3DLayout, machineIdsFor } from "../data/factoryLayouts";
import { useSelectedFactory, useTwinFactories } from "../hooks/useTwinFactories";
import { useAlertChime } from "../hooks/useAlertChime";
import FactoryPicker from "../components/panels/FactoryPicker";
import { STATUS_ORDER, STATUS_THEME, effectiveStatus, formatNumber } from "../components/twin/twinTheme";
import { applyDemo, isDemoMode } from "../components/twin/twinDemo";
import PanelSlot from "../components/panels/PanelSlot";
import WidgetPicker from "../components/panels/WidgetPicker";
import LayoutSwitcher from "../components/panels/LayoutSwitcher";
import TwinPanel from "../components/panels/TwinPanel";
import MachineBoardPanel from "../components/panels/MachineBoardPanel";
import TimelinePanel from "../components/panels/TimelinePanel";
import AlertsPanel from "../components/panels/AlertsPanel";
import GoalPanel from "../components/panels/GoalPanel";
import WorkersPanel from "../components/panels/WorkersPanel";
import LegacyCardPanel, { LegacyDataLoader } from "../components/panels/LegacyCardPanel";
import { attentionUnits, buildUnits } from "../components/panels/twinUnits";
import { AI_CARD_TO_WIDGET, LAYOUT_MODES, RIGHT_EDGE_SLOTS, WIDGETS } from "../components/panels/widgetRegistry";
import "../components/twin/twin.css";
import "../components/panels/panels.css";

const DEFAULT_STREAM = "tapo_cam";

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

/** Picks the factory, then renders its dashboard. `key` remounts everything on switch. */
export default function DashboardPage() {
  const [factory, setFactory] = useSelectedFactory();
  const factories = useTwinFactories();
  return <FactoryDashboard key={factory} factory={factory} factories={factories} onFactoryChange={setFactory} />;
}

function FactoryDashboard({ factory, factories, onFactoryChange }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const isDark = useIsDarkMode();
  const navigate = useNavigate();
  const { data: liveData, loading, error, lastRefresh, refresh } = useDigitalTwin(factory);
  const demo = isDemoMode();
  const data = useMemo(() => (demo ? applyDemo(liveData) : liveData), [demo, liveData]);
  const has3D = has3DLayout(factory);

  const { mode, slots, allSlots, setMode, setSlotWidget, applySlots, resetMode } = useDashboardLayout(factory);
  const { modalRecord, modalProcess, openRecord, closeRecord } = useRecordModal();

  const [selectedId, setSelectedId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [camera, setCamera] = useState(null);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [legacy, setLegacy] = useState(null);
  const [highlighted, setHighlighted] = useState(null);
  const [spotlight, setSpotlight] = useState(null);
  const highlightTimer = useRef(null);

  const machinesById = useMemo(() => {
    const map = {};
    (data?.machines || []).forEach((m) => { map[m.id] = m; });
    return map;
  }, [data]);

  // 小瀬: the fixed floor map. Other factories: machines used in the last 30 days.
  const machineIds = useMemo(() => machineIdsFor(factory, data?.machines || []), [factory, data]);
  const floorMachines = useMemo(() => {
    const ids = new Set(machineIds);
    return (data?.machines || []).filter((m) => ids.has(m.id));
  }, [machineIds, data]);

  const units = useMemo(() => buildUnits(machinesById, machineIds), [machinesById, machineIds]);
  const attention = useMemo(() => attentionUnits(units), [units]);
  const [chimeOn, toggleChime] = useAlertChime(attention);

  // ── Summary over the machines on the floor ──
  const summary = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
    let pieces = 0;
    machineIds.forEach((id) => {
      const m = machinesById[id];
      counts[effectiveStatus(m)] += 1;
      pieces += m?.pieces || 0;
    });
    const goal = data?.goal || 0;
    return {
      counts,
      total: machineIds.length,
      running: counts.running,
      pieces,
      goal,
      goalPct: goal > 0 ? Math.round((pieces / goal) * 100) : null,
    };
  }, [machineIds, machinesById, data]);

  const selected = selectedId ? machinesById[selectedId] || { id: selectedId, status: "off" } : null;
  const selectedPartner = selected?.pair?.together ? machinesById[selected.pair.partner] : null;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setSelectedId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  const needsLegacy = slots.some((id) => WIDGETS[id]?.legacy);

  const flashSlot = useCallback((widgetId) => {
    setHighlighted(widgetId);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlighted(null), 6000);
  }, []);

  // ── AI copilot still answers with the old card names: map them onto the slots ──
  const handleAiLayout = useCallback((cardOrder = [], highlightCard, uiAction) => {
    const widgets = cardOrder.map((c) => AI_CARD_TO_WIDGET[c]).filter((w) => w && w !== "twin");
    if (widgets.length) {
      const targetMode = mode === 1 ? 3 : mode;
      const list = [...allSlots[targetMode]];
      let k = 0;
      list.forEach((id, i) => {
        if (id === "twin" || k >= widgets.length) return;
        list[i] = widgets[k++];
      });
      applySlots(targetMode, list);
    }
    const hl = AI_CARD_TO_WIDGET[highlightCard];
    if (hl) flashSlot(hl);

    if (uiAction?.spotlight) {
      setSpotlight(uiAction.spotlight);
    } else if (uiAction?.activeWorkers?.length) {
      setSpotlight({
        type: "workers",
        title: `Active Personnel Shift Overview — ${uiAction.factory || factory} Factory`,
        summary: `Zero-noise breakdown of ${uiAction.activeWorkers.length} active operators and their machine assignments today.`,
        factory: uiAction.factory || factory,
        workers: uiAction.activeWorkers,
      });
    }
  }, [mode, allSlots, applySlots, flashSlot, factory]);

  const askAI = useCallback(() => setChatOpen(true), []);
  const openCamera = useCallback((cam = factory, stream = DEFAULT_STREAM) => setCamera({ factory: cam, stream }), [factory]);

  const renderWidget = (widgetId, index) => {
    switch (widgetId) {
      case "twin":
        return (
          <TwinPanel
            factory={factory}
            machinesById={machinesById}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isDark={isDark}
            isJa={isJa}
            attention={attention}
            counts={summary.counts}
            hasData={Boolean(data)}
            error={error}
            loading={loading}
            drawerCovers={RIGHT_EDGE_SLOTS[mode].includes(index)}
            has3D={has3D}
            units={units}
            hasSensors={Boolean(data?.hasCycleSensors)}
            onOpenCamera={(streamId) => openCamera(factory, streamId)}
          />
        );
      case "machines":
        return <MachineBoardPanel units={units} selectedId={selectedId} onSelect={setSelectedId} isJa={isJa} />;
      case "timeline":
        return (
          <TimelinePanel
            machines={floorMachines}
            selectedMachineId={selectedId}
            onSelectMachine={setSelectedId}
            isJa={isJa}
          />
        );
      case "alerts":
        return <AlertsPanel attention={attention} onSelect={setSelectedId} isJa={isJa} hasData={Boolean(data)} />;
      case "goal":
        return <GoalPanel summary={summary} units={units} onSelect={setSelectedId} isJa={isJa} />;
      case "workers":
        return <WorkersPanel units={units} onSelect={setSelectedId} isJa={isJa} hasData={Boolean(data)} />;
      default:
        return (
          <LegacyCardPanel
            widgetId={widgetId}
            legacy={legacy}
            onAskAI={askAI}
            onRecordClick={openRecord}
            onOpenCamera={openCamera}
          />
        );
    }
  };

  const refreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString(isJa ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

  const areas = LAYOUT_MODES[mode].areas;

  return (
    <section className="w-full min-h-screen lg:h-screen flex flex-col gap-4 pt-20 px-4 sm:px-6 md:px-8 pb-6 lg:overflow-hidden">
      {needsLegacy && <LegacyDataLoader onData={setLegacy} />}

      {/* ── Header: title + 3 big numbers + actions ── */}
      <header className="flex flex-col xl:flex-row xl:items-center gap-4">
        <div className="flex items-center gap-3 min-w-[220px]">
          <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 34 }}>factory</span>
          <div>
            <FactoryPicker factory={factory} factories={factories} onChange={onFactoryChange} isJa={isJa} />
            <p className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${error ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
              {isJa ? "ライブ" : "Live"} · {refreshLabel}
              {demo && (
                <button
                  type="button"
                  id="dashboard-exit-preview"
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("demo");
                    window.location.assign(url);
                  }}
                  className="ml-1 px-2 py-0.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold flex items-center gap-1"
                  title={isJa ? "サンプルデータ表示中 — クリックで実データに戻る" : "Sample data — click to show live data"}
                >
                  {isJa ? "サンプルデータ ✕" : "SAMPLE DATA ✕"}
                </button>
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
            progress={summary.total ? (summary.running / summary.total) * 100 : 0}
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
          <LayoutSwitcher mode={mode} onChange={setMode} isJa={isJa} />
          <button
            type="button"
            onClick={() => { refresh(); legacy?.refresh?.(); }}
            className="twin-icon-btn"
            title={isJa ? "更新" : "Refresh"}
            aria-label={isJa ? "更新" : "Refresh"}
          >
            <span className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`}>refresh</span>
          </button>
          <button
            type="button"
            id="dashboard-chime-toggle"
            onClick={toggleChime}
            className={`twin-icon-btn ${chimeOn ? "is-on" : ""}`}
            aria-pressed={chimeOn}
            title={isJa ? (chimeOn ? "アラート音: オン" : "アラート音: オフ") : (chimeOn ? "Alert sound: on" : "Alert sound: off")}
            aria-label={isJa ? "アラート音" : "Alert sound"}
          >
            <span className="material-symbols-outlined">{chimeOn ? "notifications_active" : "notifications_off"}</span>
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

      {/* ── Body: layout grid + collapsible AI chat ── */}
      <div className="flex-1 min-h-0 flex gap-4">
        <div className="relative flex-1 min-w-0 min-h-0 flex">
          <div className={`dash-grid dash-grid--${mode}`}>
            {slots.map((widgetId, i) => (
              <PanelSlot
                key={widgetId}
                widgetId={widgetId}
                area={areas[i]}
                highlighted={highlighted === widgetId}
                onChange={() => setPickerSlot(i)}
                isJa={isJa}
                flush={widgetId === "twin"}
                title={widgetId === "twin" && !has3D ? (isJa ? "工場フロア" : "Factory floor") : undefined}
              >
                {renderWidget(widgetId, i)}
              </PanelSlot>
            ))}
          </div>

          <MachineDrawer
            machine={selected}
            partner={selectedPartner}
            isJa={isJa}
            onClose={() => setSelectedId(null)}
            onCamera={() => openCamera()}
            onDetails={() => navigate("/factoryStatus")}
          />

          {spotlight && (
            <div className="dash-spotlight">
              <AIShapeRenderer spotlight={spotlight} onClose={() => setSpotlight(null)} onAskAI={askAI} />
            </div>
          )}
        </div>

        {chatOpen && (
          <div className="hidden lg:block w-80 xl:w-96 flex-shrink-0 min-h-0">
            <AICopilotPanel
              currentPersona="plant_operations"
              kpiContext={{ factory, ...summary }}
              onReorderCards={handleAiLayout}
              onReset={() => { setSpotlight(null); setHighlighted(null); }}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>

      <WidgetPicker
        open={pickerSlot !== null}
        currentId={pickerSlot !== null ? slots[pickerSlot] : null}
        usedIds={slots}
        isJa={isJa}
        onPick={(id) => { setSlotWidget(pickerSlot, id); setPickerSlot(null); }}
        onReset={() => { resetMode(); setPickerSlot(null); }}
        onClose={() => setPickerSlot(null)}
      />

      {camera && (
        <CameraModal
          factory={camera.factory || factory}
          stream={camera.stream || DEFAULT_STREAM}
          onClose={() => setCamera(null)}
        />
      )}

      {modalRecord && (
        <RecordDetailModal record={modalRecord} processName={modalProcess} onClose={closeRecord} />
      )}
    </section>
  );
}
