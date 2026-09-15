import React from "react";
import { getFactoryBadgeStyle } from "./equipmentAnalyticsUtils";

export default function MachineCard({
  machine,
  factory,
  analytics,
  maxFleetShots = 0,
  onClick,
  isJa = true,
}) {
  const {
    totalShots = 0,
    avgShotsPerDay = 0,
    avgShotsPerHour = 0,
    avgWorkingHoursPerDay = 0,
    defectRate = 0,
    totalDays = 0,
    workingHours = 0,
  } = analytics || {};

  const isActive = totalShots > 0;
  const pctOfMax = maxFleetShots > 0 ? Math.min(100, Math.round((totalShots / maxFleetShots) * 100)) : 0;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="freya-card group flex flex-col justify-between rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--freya-blue)] hover:shadow-md cursor-pointer select-none"
    >
      <div>
        {/* Top Row: Machine name, factory tag, active status badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]">
              <span className="material-symbols-outlined text-[18px]">precision_manufacturing</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--freya-blue)] transition-colors" title={machine}>
                {machine}
              </h4>
              {factory && (() => {
                const facStyle = getFactoryBadgeStyle(factory);
                return (
                  <span className={`inline-flex items-center gap-1 mt-0.5 rounded-[4px] ${facStyle.bg} ${facStyle.text} px-1.5 py-0.5 text-[10px] font-semibold border ${facStyle.border}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${facStyle.dot}`} />
                    {factory}
                  </span>
                );
              })()}
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
              isActive
                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border border-slate-500/20 bg-slate-500/10 text-slate-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            {isActive ? (isJa ? "稼働" : "Active") : (isJa ? "未稼働" : "Idle")}
          </span>
        </div>

        {/* Hero Metric: Total Shots */}
        <div className="mt-4 rounded-lg bg-[var(--surface-subtle)]/70 p-3 border border-[var(--border)]/50">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {isJa ? "総ショット数" : "Total Shots"}
            </span>
            {pctOfMax > 0 && (
              <span className="text-[10px] font-medium text-[var(--text-muted)]">
                {pctOfMax}% {isJa ? "フリート比" : "of peak"}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-[var(--text-primary)] tabular-nums">
              {totalShots.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {isJa ? "shots" : "shots"}
            </span>
          </div>

          {/* Progress bar relative to top performer */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--freya-blue)] to-indigo-500 transition-all duration-500"
              style={{ width: `${pctOfMax}%` }}
            />
          </div>
        </div>

        {/* 2x2 Sub-metrics Grid */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* Avg Shots / Day */}
          <div className="rounded-md border border-[var(--border)]/40 bg-[var(--surface)] p-2">
            <span className="text-[10px] font-medium text-[var(--text-muted)] block">
              {isJa ? "平均 / 日" : "Avg / Day"}
            </span>
            <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums mt-0.5 block">
              {Number(avgShotsPerDay).toLocaleString()}{" "}
              <span className="text-[10px] font-normal text-[var(--text-muted)]">/d</span>
            </span>
          </div>

          {/* Avg Shots / Hour */}
          <div className="rounded-md border border-[var(--border)]/40 bg-[var(--surface)] p-2">
            <span className="text-[10px] font-medium text-[var(--text-muted)] block">
              {isJa ? "平均 / 時" : "Avg / Hour"}
            </span>
            <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums mt-0.5 block">
              {Number(avgShotsPerHour).toLocaleString()}{" "}
              <span className="text-[10px] font-normal text-[var(--text-muted)]">/h</span>
            </span>
          </div>

          {/* Working Hours / Day */}
          <div className="rounded-md border border-[var(--border)]/40 bg-[var(--surface)] p-2">
            <span className="text-[10px] font-medium text-[var(--text-muted)] block">
              {isJa ? "稼働 / 日" : "Hours / Day"}
            </span>
            <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums mt-0.5 block">
              {avgWorkingHoursPerDay}
              <span className="text-[10px] font-normal text-[var(--text-muted)]">h</span>
            </span>
          </div>

          {/* Defect Rate */}
          <div className="rounded-md border border-[var(--border)]/40 bg-[var(--surface)] p-2">
            <span className="text-[10px] font-medium text-[var(--text-muted)] block">
              {isJa ? "不良率" : "Defect Rate"}
            </span>
            <span
              className={`text-xs font-bold tabular-nums mt-0.5 block ${
                defectRate > 2 ? "text-rose-500" : "text-[var(--text-primary)]"
              }`}
            >
              {defectRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)]/60 pt-3 text-[11px] text-[var(--text-muted)]">
        <span>
          {totalDays} {isJa ? "稼働日" : "days"} ({workingHours}h)
        </span>
        <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--freya-blue)] group-hover:translate-x-0.5 transition-transform">
          <span>{isJa ? "詳細を見る" : "Details"}</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </span>
      </div>
    </div>
  );
}
