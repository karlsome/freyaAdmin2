import { useState, useRef, useEffect, useMemo } from "react";
import { useTodayData } from "../hooks/useTodayData";
import { useRecordModal } from "../hooks/useRecordModal";
import { useLanguage } from "../contexts/LanguageContext";

import PageHeader from "../components/PageHeader";
import RecordDetailModal from "../components/RecordDetailModal";
import CameraModal from "../components/CameraModal";

import FinanceOverviewCard from "../components/dashboard/FinanceOverviewCard";
import LiveCameraFeedCard from "../components/dashboard/LiveCameraFeedCard";
import FactoryProductionCard from "../components/dashboard/FactoryProductionCard";
import MachineTelemetryCard from "../components/dashboard/MachineTelemetryCard";
import QualityDefectsCard from "../components/dashboard/QualityDefectsCard";
import IssuesApprovalsCard from "../components/dashboard/IssuesApprovalsCard";
import AICopilotPanel from "../components/dashboard/AICopilotPanel";
import AIShapeRenderer from "../components/dashboard/AIShapeRenderer";

const PERSONA_PRESETS = {
  plant_operations: {
    id: "plant_operations",
    label: "Plant Operations",
    icon: "factory",
    description: "Focus on output volume, line bottlenecks, and worker efficiency",
    cards: ["production", "defects", "camera", "telemetry", "issues", "finance"],
  },
  executive: {
    id: "executive",
    label: "Executive & Financials",
    icon: "payments",
    description: "Focus on gross production value, defect scrap cost, and margins",
    cards: ["finance", "defects", "production", "issues", "camera", "telemetry"],
  },
  maintenance: {
    id: "maintenance",
    label: "Maintenance & Facilities",
    icon: "build",
    description: "Focus on machine idle times, sensor diagnostics, and live cameras",
    cards: ["telemetry", "camera", "issues", "production", "defects", "finance"],
  },
  all: {
    id: "all",
    label: "All Cards Overview",
    icon: "grid_view",
    description: "Full modular overview across all operational metrics",
    cards: ["production", "finance", "defects", "camera", "telemetry", "issues"],
  },
};

export default function DashboardPage() {
  const { kpis, issues, recent, byFactory, byProcess, loading, error, lastRefresh, refresh } = useTodayData();
  const { modalRecord, modalProcess, openRecord, closeRecord } = useRecordModal();
  const { t, language } = useLanguage();

  // Persona Preset state
  const [currentPersona, setCurrentPersona] = useState("plant_operations");
  const [activeCardOrder, setActiveCardOrder] = useState(PERSONA_PRESETS.plant_operations.cards);
  const [highlightedCard, setHighlightedCard] = useState(null);
  const highlightTimeoutRef = useRef(null);

  // AI Copilot state
  const [copilotOpen, setCopilotOpen] = useState(true);

  // Camera Modal state
  const [cameraModalConfig, setCameraModalConfig] = useState({ open: false, factory: '小瀬', stream: 'tapo_cam' });

  const today = new Date().toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const refreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString(language === "ja" ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Handle persona tab switch
  const handleSelectPersona = (personaId) => {
    setCurrentPersona(personaId);
    const targetCards = PERSONA_PRESETS[personaId]?.cards || PERSONA_PRESETS.plant_operations.cards;
    setActiveCardOrder(targetCards);
    setHighlightedCard(targetCards[0]);

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedCard(null);
    }, 2500);
  };

  const [aiMetadata, setAiMetadata] = useState(null);
  const [aiSpotlight, setAiSpotlight] = useState(null);

  // Reorder cards dynamically (triggered by AI or user prompt)
  const handleReorderCards = (newOrder, highlightId, extraMetadata = null) => {
    setActiveCardOrder(newOrder);
    if (extraMetadata) {
      setAiMetadata(extraMetadata);
      if (extraMetadata.spotlight) {
        setAiSpotlight(extraMetadata.spotlight);
      } else if (extraMetadata.activeWorkers && extraMetadata.activeWorkers.length > 0) {
        setAiSpotlight({
          type: "workers",
          title: `Active Personnel Shift Overview — ${extraMetadata.factory || "小瀬"} Factory`,
          summary: `Zero-noise breakdown of ${extraMetadata.activeWorkers.length} active operators and their machine assignments today.`,
          factory: extraMetadata.factory || "小瀬",
          workers: extraMetadata.activeWorkers
        });
      }
    }
    if (highlightId) {
      setHighlightedCard(highlightId);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedCard(null);
      }, 6000);

      // Smoothly scroll the highlighted card or spotlight into view
      setTimeout(() => {
        const el = document.getElementById(extraMetadata?.spotlight ? "ai-spotlight-section" : `card-wrapper-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  };

  const handleResetToDefault = () => {
    const defaultCards = PERSONA_PRESETS[currentPersona]?.cards || PERSONA_PRESETS.plant_operations.cards;
    setActiveCardOrder(defaultCards);
    setHighlightedCard(null);
    setAiMetadata(null);
    setAiSpotlight(null);
  };

  // Component Map
  const renderCard = (cardId) => {
    const isHighlighted = highlightedCard === cardId;

    switch (cardId) {
      case "finance":
        return (
          <FinanceOverviewCard
            key="finance"
            kpis={kpis}
            byProcess={byProcess}
            loading={loading}
            isHighlighted={isHighlighted}
            onAskAI={(prompt) => {
              setCopilotOpen(true);
              handleReorderCards(["finance", "defects", "production", "telemetry", "camera", "issues"], "finance");
            }}
          />
        );
      case "camera":
        return (
          <LiveCameraFeedCard
            key="camera"
            isHighlighted={isHighlighted}
            onOpenModal={(factory, stream) => setCameraModalConfig({ open: true, factory, stream })}
            onAskAI={(prompt) => {
              setCopilotOpen(true);
              handleReorderCards(["camera", "telemetry", "production", "defects", "issues", "finance"], "camera");
            }}
          />
        );
      case "production":
        return (
          <FactoryProductionCard
            key="production"
            kpis={kpis}
            byFactory={byFactory}
            byProcess={byProcess}
            loading={loading}
            isHighlighted={isHighlighted}
            aiMetadata={aiMetadata}
            onAskAI={(prompt) => {
              setCopilotOpen(true);
              handleReorderCards(["production", "defects", "camera", "telemetry", "issues", "finance"], "production");
            }}
          />
        );
      case "telemetry":
        return (
          <MachineTelemetryCard
            key="telemetry"
            kpis={kpis}
            loading={loading}
            isHighlighted={isHighlighted}
            onAskAI={(prompt) => {
              setCopilotOpen(true);
              handleReorderCards(["telemetry", "camera", "issues", "production", "defects", "finance"], "telemetry");
            }}
          />
        );
      case "defects":
        return (
          <QualityDefectsCard
            key="defects"
            kpis={kpis}
            issues={issues}
            byProcess={byProcess}
            loading={loading}
            isHighlighted={isHighlighted}
            onRecordClick={openRecord}
            onAskAI={(prompt) => {
              setCopilotOpen(true);
              handleReorderCards(["defects", "production", "issues", "finance", "camera", "telemetry"], "defects");
            }}
          />
        );
      case "issues":
        return (
          <IssuesApprovalsCard
            key="issues"
            issues={issues}
            recent={recent}
            isHighlighted={isHighlighted}
            onRecordClick={openRecord}
            onAskAI={(prompt) => {
              setCopilotOpen(true);
              handleReorderCards(["issues", "defects", "production", "telemetry", "finance", "camera"], "issues");
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section className="w-full h-screen overflow-y-auto space-y-5 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      {/* ── Top Header ── */}
      <PageHeader
        title={t("dashboard")}
        subtitle={today}
        className="sm:mb-4"
        actionsClassName="w-full sm:w-auto sm:justify-end gap-2.5"
        actions={(
          <>
            <button
              onClick={() => setCopilotOpen((prev) => !prev)}
              className={`h-10 px-3.5 text-xs font-semibold rounded-[6px] border transition-all flex items-center gap-2 ${
                copilotOpen
                  ? "bg-[var(--freya-blue-subtle)] text-[var(--freya-blue)] border-[var(--freya-blue)]"
                  : "bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>smart_toy</span>
              <span>{copilotOpen ? "Hide Copilot" : "AI Copilot"}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            <button
              onClick={refresh}
              disabled={loading}
              className="freya-btn-secondary h-10 px-4 text-xs font-semibold"
            >
              <span className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>refresh</span>
              {refreshLabel ? `${t("refresh")} · ${refreshLabel}` : t("refresh")}
            </button>
          </>
        )}
      />

      {/* ── Error banner ── */}
      {error && (
        <div className="freya-card border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-4 mb-4 flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 20 }}>error</span>
          <p className="text-sm font-semibold">Backend unreachable — data may be stale. ({error})</p>
        </div>
      )}

      {/* ── Split Layout: Dynamic Canvas (Left) + AI Copilot Panel (Right) ── */}
      <div className="flex flex-col lg:flex-row items-start gap-5">
        {/* ── Dynamic Components Canvas (Left) ── */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* Persona Presets Bar */}
          <div className="p-2 sm:p-2.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] px-1 hidden md:inline">
                Role View:
              </span>
              <div className="inline-flex p-0.5 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] flex-wrap gap-0.5">
                {Object.values(PERSONA_PRESETS).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPersona(preset.id)}
                    className={`h-8 px-3 text-xs font-semibold rounded-[4px] transition-all flex items-center gap-1.5 ${
                      currentPersona === preset.id
                        ? "bg-[var(--freya-blue)] text-white shadow-xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={handleResetToDefault}
                title="Reset layout order"
                className="h-8 px-2.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-[4px] hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
                <span>Reset Grid</span>
              </button>
            </div>
          </div>

          {/* Description hint */}
          <p className="text-xs text-[var(--text-muted)] px-1">
            {PERSONA_PRESETS[currentPersona]?.description} · <em>AI prompts or presets dynamically reconfigure the cards below.</em>
          </p>

          {/* ── AI Spotlight View: Big, upfront, noise-free ── */}
          {aiSpotlight && (
            <div id="ai-spotlight-section" className="w-full mb-6 transition-all duration-300">
              <AIShapeRenderer
                spotlight={aiSpotlight}
                onClose={() => setAiSpotlight(null)}
                onAskAI={(prompt) => {
                  setCopilotOpen(true);
                }}
              />

              {/* Separator indicating standard background cards below */}
              <div className="flex items-center justify-between pt-4 pb-1 text-xs text-[var(--text-muted)] border-t border-[var(--border)] mt-4">
                <div className="flex items-center gap-1.5 font-semibold uppercase tracking-[0.04em]">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>layers</span>
                  <span>Standard Facility Overview (Secondary)</span>
                </div>
                <button
                  onClick={() => setAiSpotlight(null)}
                  className="hover:text-[var(--text-primary)] underline transition-colors cursor-pointer text-[11px]"
                >
                  Dismiss Focus View
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Cards Grid */}
          <div className={`grid grid-cols-1 ${copilotOpen ? "xl:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"} gap-4 sm:gap-5 transition-all duration-300`}>
            {activeCardOrder.map((cardId) => (
              <div key={cardId} id={`card-wrapper-${cardId}`}>
                {renderCard(cardId)}
              </div>
            ))}
          </div>
        </div>

        {/* ── AI Copilot Panel (Right) ── */}
        {copilotOpen && (
          <div className="w-full lg:w-80 xl:w-96 lg:sticky lg:top-20 h-[560px] lg:h-[calc(100vh-10.5rem)] flex-shrink-0">
            <AICopilotPanel
              currentPersona={currentPersona}
              kpiContext={kpis}
              onReorderCards={handleReorderCards}
              onReset={handleResetToDefault}
              onClose={() => setCopilotOpen(false)}
            />
          </div>
        )}
      </div>

      {/* ── Record detail modal ── */}
      {modalRecord && (
        <RecordDetailModal
          record={modalRecord}
          processName={modalProcess}
          onClose={closeRecord}
        />
      )}

      {/* ── Fullscreen Camera Modal ── */}
      {cameraModalConfig.open && (
        <CameraModal
          factory={cameraModalConfig.factory}
          stream={cameraModalConfig.stream}
          onClose={() => setCameraModalConfig({ open: false, factory: '小瀬', stream: 'tapo_cam' })}
        />
      )}
    </section>
  );
}
