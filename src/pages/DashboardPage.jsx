import { useState } from "react";
import FactoryCard from "../components/FactoryCard";
import { factories } from "../data/mockDashboard";
import { getDefectStatus } from "../utils/statusHelpers";

// ─── Summary stat chip ────────────────────────────────────────────────────────
function StatChip({ icon, label, value, color = "text-on-surface" }) {
  return (
    <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color === "text-on-surface" ? "bg-surface-container-high" : color === "text-emerald-600 dark:text-emerald-400" ? "bg-emerald-500/10" : color === "text-amber-600 dark:text-amber-400" ? "bg-amber-500/10" : "bg-error/10"}`}>
        <span className={`material-symbols-outlined ${color}`} style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-black text-on-surface leading-none">{value}</p>
        <p className="text-[11px] text-on-surface-variant mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage({ onNavigateToFactory }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Derive summary stats from mock data
  const total = factories.length;
  const normal   = factories.filter((f) => getDefectStatus(f.defectRate).level === "normal").length;
  const warnings = factories.filter((f) => getDefectStatus(f.defectRate).level === "warning").length;
  const critical = factories.filter((f) => getDefectStatus(f.defectRate).level === "high").length;

  return (
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide">

      {/* ── Page header ── */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold font-headline tracking-tight text-on-surface">
            Factory Overview
          </h2>
          <p className="text-on-surface-variant mt-1 text-sm">{today}</p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          Refresh All
        </button>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatChip
          icon="factory"
          label="Total Facilities"
          value={total}
          color="text-on-surface"
        />
        <StatChip
          icon="check_circle"
          label="Normal"
          value={normal}
          color="text-emerald-600 dark:text-emerald-400"
        />
        <StatChip
          icon="warning"
          label="Warnings"
          value={warnings}
          color="text-amber-600 dark:text-amber-400"
        />
        <StatChip
          icon="error"
          label="Critical"
          value={critical}
          color="text-error"
        />
      </div>

      {/* ── Factory grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-8">
        {factories.map((factory) => (
          <FactoryCard
            key={`${factory.name}-${refreshKey}`}
            factory={factory}
            onClick={() => onNavigateToFactory?.(factory.name)}
          />
        ))}
      </div>
    </section>
  );
}
