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
      <div className="glass-card rounded-3xl p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-on-surface">Production Goals</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Set goal quantities first, then place them onto equipment schedules.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>
              {importing ? "Reading CSV…" : "Upload CSV"}
            </button>
            <button
              type="button"
              onClick={onOpenManualGoal}
              className="flex items-center gap-2 rounded-2xl kinetic-gradient px-4 py-2 text-xs font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.22)] transition hover:opacity-90"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>
              Manual Input
            </button>
            <button
              type="button"
              onClick={onOpenSmartScheduling}
              disabled={smartSchedulingBusy || !goals.length}
              className="flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className={`material-symbols-outlined ${smartSchedulingBusy ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>
                auto_awesome
              </span>
              {smartSchedulingBusy ? "Scheduling…" : "Smart Scheduling"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <label htmlFor={inputId} className="sr-only">Search goals</label>
            <div className="ui-control-surface flex h-11 items-center gap-3 rounded-2xl border border-outline-variant/20 px-4">
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>search</span>
              <input
                id={inputId}
                type="text"
                value={goalSearch}
                onChange={(event) => onGoalSearchChange(event.target.value)}
                placeholder="Search by 背番号, 品番, or 品名…"
                className="h-full flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-xs font-bold text-on-surface-variant">
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