import { useEffect, useId, useRef } from "react";
import PlannerGoalList from "./PlannerGoalList";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PlannerGoalsPanel({
  goals = [],
  currentDate,
  products = [],
  productColors = {},
  scheduledProducts = [],
  goalSearch,
  importing,
  smartSchedulingBusy,
  reconciling = false,
  outOfSyncCount = 0,
  onGoalSearchChange,
  onCsvSelected,
  onOpenManualGoal,
  onOpenSmartScheduling,
  onOpenBulkEdit,
  onReconcileGoals,
  onReconcileSingleGoal,
  onDeleteGoal,
  onScheduleGoal,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const inputId = useId();
  const fileInputRef = useRef(null);
  const renderT0Ref = useRef(performance.now());
  renderT0Ref.current = performance.now();

  console.log(`⏱️ [PlannerGoalsPanel] Rendering goals panel with ${goals.length} goals`);

  useEffect(() => {
    console.log(`✅ [PlannerGoalsPanel] Rendered to DOM in ${(performance.now() - renderT0Ref.current).toFixed(1)}ms`);
  });

  return (
    <div className="space-y-4">
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {isJa ? "生産目標" : "Production Goals"}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {isJa ? "まず目標数量を設定し、設備スケジュールに配置します。" : "Set goal quantities first, then place them onto equipment schedules."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-none"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>upload</span>
              {importing ? (isJa ? "CSV読込中…" : "Reading CSV…") : (isJa ? "CSVアップロード" : "Upload CSV")}
            </button>
            <button
              type="button"
              onClick={onOpenManualGoal}
              className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-none"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add_circle</span>
              {isJa ? "手動入力" : "Manual Input"}
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
              {smartSchedulingBusy ? (isJa ? "計画立案中…" : "Scheduling…") : (isJa ? "スマート計画" : "Smart Scheduling")}
            </button>
            <button
              type="button"
              onClick={onOpenBulkEdit}
              disabled={!goals.length}
              className="flex items-center gap-1.5 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40 transition-colors shadow-none"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit_note</span>
              {isJa ? "目標編集" : "Edit Goals"}
            </button>
            <button
              type="button"
              onClick={onReconcileGoals}
              disabled={reconciling || !goals.length}
              className={`flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition-colors shadow-none disabled:cursor-not-allowed disabled:opacity-40 ${
                outOfSyncCount > 0
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              }`}
              title={isJa ? "タイムラインの実際の割当数量と生産目標を同期します" : "Reconcile goal quantities with actual items scheduled on the timeline"}
            >
              <span className={`material-symbols-outlined ${reconciling ? "animate-spin" : ""}`} style={{ fontSize: 15 }}>
                sync
              </span>
              <span>{reconciling ? (isJa ? "同期中…" : "Syncing…") : (isJa ? "タイムライン同期" : "Sync with Timeline")}</span>
              {outOfSyncCount > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[9px] font-bold text-white">
                  {outOfSyncCount}
                </span>
              )}
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
                placeholder={isJa ? "背番号、品番、品名で検索…" : "Search by 背番号, 品番, or 品名…"}
                className="h-full flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-mono text-[var(--text-secondary)]">
            {isJa ? `表示中: ${goals.length} 件の目標` : `${goals.length} goal${goals.length === 1 ? "" : "s"} in view`}
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
        onReconcileSingleGoal={onReconcileSingleGoal}
      />
    </div>
  );
}