import { useId, useRef } from "react";
import PlannerGoalList from "./PlannerGoalList";

export default function PlannerGoalsPanel({
  goals = [],
  currentDate,
  products = [],
  productColors = {},
  scheduledProducts = [],
  goalSearch,
  importing,
  smartSchedulingBusy,
  onGoalSearchChange,
  onCsvSelected,
  onOpenManualGoal,
  onOpenSmartScheduling,
  onDeleteGoal,
  onScheduleGoal,
}) {
  const inputId = useId();
  const fileInputRef = useRef(null);

  return (
    <div className="space-y-4">
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Production Goals</h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Set goal quantities first, then place them onto equipment schedules.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-none"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>upload</span>
              {importing ? "Reading CSV…" : "Upload CSV"}
            </button>
            <button
              type="button"
              onClick={onOpenManualGoal}
              className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-none"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add_circle</span>
              Manual Input
            </button>
            <button
              type="button"
              onClick={onOpenSmartScheduling}
              disabled={smartSchedulingBusy || !goals.length}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--freya-blue)] hover:bg-[var(--freya-blue)]/20 disabled:cursor-not-allowed disabled:opacity-40 transition-colors shadow-none"
            >
              <span className={`material-symbols-outlined ${smartSchedulingBusy ? "animate-spin" : ""}`} style={{ fontSize: 15 }}>
                auto_awesome
              </span>
              {smartSchedulingBusy ? "Scheduling…" : "Smart Scheduling"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <label htmlFor={inputId} className="sr-only">Search goals</label>
            <div className="flex h-8 items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] focus-within:border-[var(--freya-blue)] transition-colors">
              <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>search</span>
              <input
                id={inputId}
                type="text"
                value={goalSearch}
                onChange={(event) => onGoalSearchChange(event.target.value)}
                placeholder="Search by 背番号, 品番, or 品名…"
                className="h-full flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-mono text-[var(--text-secondary)]">
            {goals.length} goal{goals.length === 1 ? "" : "s"} in view
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            onCsvSelected(event.target.files?.[0] || null);
            event.target.value = "";
          }}
        />
      </div>

      <PlannerGoalList
        goals={goals}
        currentDate={currentDate}
        scheduledProducts={scheduledProducts}
        products={products}
        productColors={productColors}
        onDeleteGoal={onDeleteGoal}
        onScheduleGoal={onScheduleGoal}
      />
    </div>
  );
}