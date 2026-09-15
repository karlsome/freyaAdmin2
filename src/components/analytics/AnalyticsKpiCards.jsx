import React from "react";

export function AnalyticsKpiCard({ title, value, subtext, icon, color = "blue", badge }) {
  const colorMap = {
    blue: {
      bg: "bg-[var(--freya-blue)]/10",
      text: "text-[var(--freya-blue)]",
      border: "border-[var(--freya-blue)]/20",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-500",
      border: "border-emerald-500/20",
    },
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-500",
      border: "border-amber-500/20",
    },
    rose: {
      bg: "bg-rose-500/10",
      text: "text-rose-500",
      border: "border-rose-500/20",
    },
    indigo: {
      bg: "bg-indigo-500/10",
      text: "text-indigo-500",
      border: "border-indigo-500/20",
    },
    purple: {
      bg: "bg-purple-500/10",
      text: "text-purple-500",
      border: "border-purple-500/20",
    },
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs flex items-center gap-4 transition hover:border-[var(--border-strong)]">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[8px] border ${scheme.bg} ${scheme.text} ${scheme.border}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[var(--text-muted)] truncate">{title}</p>
          {badge && (
            <span className={`rounded-[4px] px-1.5 py-0.5 text-[10px] font-mono font-semibold ${badge.style || "bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border)]"}`}>
              {badge.text}
            </span>
          )}
        </div>
        <p
          className={`mt-0.5 font-bold text-[var(--text-primary)] tabular-nums truncate ${
            typeof value === "string" && value.length > 16 ? "text-sm font-semibold leading-tight" : "font-mono text-xl"
          }`}
          title={typeof value === "string" ? value : undefined}
        >
          {value ?? "—"}
        </p>
        {subtext && (
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)] truncate" title={typeof subtext === "string" ? subtext : undefined}>
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
