import { useState } from "react";
import StatusGrid from "./shapes/StatusGrid";
import KpiTiles from "./shapes/KpiTiles";
import RankingList from "./shapes/RankingList";
import EnvironmentPanel from "./shapes/EnvironmentPanel";
import ComparisonPanel from "./shapes/ComparisonPanel";
import FinanceSummary from "./shapes/FinanceSummary";
import AISpotlightCard from "./AISpotlightCard";

export default function AIShapeRenderer({ spotlight, onClose, onAskAI }) {
  if (!spotlight) return null;

  // Check if spotlight explicitly declares a declarative SDUI Shape
  const shapeType = spotlight.shape || null;

  // Icon and label mappings
  const getShapeMeta = () => {
    switch (shapeType) {
      case "StatusGrid":
        return { icon: "precision_manufacturing", label: "Live Equipment Grid", color: "text-emerald-500" };
      case "KpiTiles":
        return { icon: "speed", label: "Headline KPI Summary", color: "text-[var(--freya-blue)]" };
      case "RankingList":
        return { icon: "leaderboard", label: "Operational Ranking", color: "text-amber-500" };
      case "EnvironmentPanel":
        return { icon: "thermostat", label: "Environmental Telemetry", color: "text-cyan-500" };
      case "ComparisonPanel":
        return { icon: "compare_arrows", label: "Benchmark Comparison", color: "text-indigo-500" };
      case "FinanceSummary":
        return { icon: "payments", label: "Financial Analysis", color: "text-emerald-600" };
      default:
        return { icon: "auto_awesome", label: "AI Spotlight", color: "text-[var(--freya-blue)]" };
    }
  };

  const meta = getShapeMeta();

  // If no new shape is declared, fall back to our existing multi-view AISpotlightCard
  if (!shapeType) {
    return (
      <AISpotlightCard
        spotlight={spotlight}
        onClose={onClose}
        onAskAI={onAskAI}
      />
    );
  }

  return (
    <div className="w-full rounded-[10px] bg-[var(--surface)] border border-[var(--freya-blue)]/40 p-4 sm:p-5 shadow-xs relative overflow-hidden transition-all duration-300">
      {/* Decorative top accent glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--freya-blue)] to-transparent opacity-80" />

      {/* ── Spotlight Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[6px] bg-[var(--freya-blue-subtle)] text-[var(--freya-blue)] flex items-center justify-center flex-shrink-0 border border-[var(--freya-blue)]/20 shadow-2xs mt-0.5">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              {meta.icon}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
                {spotlight.title || meta.label}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-[4px] uppercase tracking-[0.04em] bg-[var(--freya-blue-subtle)] text-[var(--freya-blue)] border border-[var(--freya-blue)]/30">
                {meta.label}
              </span>
              {spotlight.factory && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-[4px] bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border)]">
                  {spotlight.factory === "All" ? "All Facilities" : spotlight.factory}
                </span>
              )}
            </div>

            {spotlight.summary && (
              <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                {spotlight.summary}
              </p>
            )}
          </div>
        </div>

        {/* Dismiss Button */}
        {onClose && (
          <button
            onClick={onClose}
            title="Dismiss Spotlight"
            className="w-7 h-7 rounded-[4px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors flex-shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        )}
      </div>

      {/* ── Render Designated Shape Component ── */}
      <div className="w-full">
        {shapeType === "StatusGrid" && <StatusGrid data={spotlight.data || spotlight} onAskAI={onAskAI} />}
        {shapeType === "KpiTiles" && <KpiTiles data={spotlight.data || spotlight} onAskAI={onAskAI} />}
        {shapeType === "RankingList" && <RankingList data={spotlight.data || spotlight} onAskAI={onAskAI} />}
        {shapeType === "EnvironmentPanel" && <EnvironmentPanel data={spotlight.data || spotlight} onAskAI={onAskAI} />}
        {shapeType === "ComparisonPanel" && <ComparisonPanel data={spotlight.data || spotlight} onAskAI={onAskAI} />}
        {shapeType === "FinanceSummary" && <FinanceSummary data={spotlight.data || spotlight} onAskAI={onAskAI} />}
      </div>
    </div>
  );
}
