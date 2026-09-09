import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PlannerPreviewTab({
  preview,
  loading = false,
  saving = false,
  publishing = false,
  factoryName,
  planDate,
  onRefresh,
  onSaveDraft,
  onDiscardDraft,
  onPublish,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const renderT0Ref = useRef(performance.now());
  renderT0Ref.current = performance.now();

  const [activeSubTab, setActiveSubTab] = useState("priority"); // "priority" | "inventory"
  const [scheduleUntil, setScheduleUntil] = useState("17:30");
  const [note, setNote] = useState("");

  console.log(`⏱️ [PlannerPreviewTab] Rendering preview tab (loading=${loading})`);

  useEffect(() => {
    console.log(`✅ [PlannerPreviewTab] Rendered to DOM in ${(performance.now() - renderT0Ref.current).toFixed(1)}ms`);
  });

  if (!factoryName) {
    return (
      <div className="freya-card rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center text-[var(--text-muted)]">
        <span className="material-symbols-outlined text-4xl text-[var(--freya-blue)] mb-2">radar</span>
        <p className="text-base font-semibold text-[var(--text-primary)]">
          {isJa ? "工場を選択してください" : "Select a factory"}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {isJa ? "需要キュー（NODA引当不足）と在庫情報を照合して自動計画プレビューを作成します。" : "Select a factory above to compare current inventory, customer demand, and auto-planning draft."}
        </p>
      </div>
    );
  }

  if (loading && !preview) {
    return (
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--freya-blue)] border-t-transparent" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {isJa ? "需要自動計画プレビューを構築中…" : "Building auto-plan preview…"}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {isJa ? "未完了不足ライン、現在在庫、および機械割当を収集しています。" : "Collecting unfinished shortages, FIFO inventory, and equipment assignments."}
        </p>
      </div>
    );
  }

  const summary = preview?.summary || {};
  const priorityRows = Array.isArray(preview?.priorityRows) ? preview.priorityRows : [];
  const inventoryRows = Array.isArray(preview?.inventoryRows) ? preview.inventoryRows : [];
  const savedDraft = preview?.savedDraft || null;
  const isStale = savedDraft?.basisComparison?.isStale === true;

  // Use saved draft assignments if available, otherwise simulation assignments
  const rawAssignments = savedDraft?.assignments || preview?.simulation?.assignments || [];
  const assignmentsByEquipment = {};
  rawAssignments.forEach((item) => {
    const eq = item.equipment || "Other";
    if (!assignmentsByEquipment[eq]) assignmentsByEquipment[eq] = [];
    assignmentsByEquipment[eq].push(item);
  });
  const equipmentList = Object.keys(assignmentsByEquipment).sort();

  return (
    <div className="space-y-4">
      {/* ── Top Summary & Actions Strip ── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {isJa ? "需要自動計画プレビュー" : "Demand-Driven Auto Planning Preview"}
              </h3>
              {savedDraft && (
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                  {isJa ? "保存済下書き" : "Saved Draft"}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {isJa
                ? "納入指示日順の不足キューを現在在庫(FIFO)と突合し、機械別に最適な順序で自動配置します。"
                : "Matches customer shortage demand against FIFO inventory and auto-assigns eligible machines."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRefresh?.(true)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition-colors"
            >
              <span className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`} style={{ fontSize: 15 }}>refresh</span>
              {isJa ? "再計算" : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() => onSaveDraft?.({ scheduleUntilTime: scheduleUntil, assignments: rawAssignments, basisRows: priorityRows })}
              disabled={saving || rawAssignments.length === 0}
              className="flex items-center gap-1.5 rounded-[6px] border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>save</span>
              {saving ? (isJa ? "保存中…" : "Saving…") : (isJa ? "下書き保存" : "Save Draft")}
            </button>

            {savedDraft && (
              <button
                type="button"
                onClick={onDiscardDraft}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-[6px] border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete_sweep</span>
                {isJa ? "下書き破棄" : "Discard Draft"}
              </button>
            )}

            <button
              type="button"
              onClick={() => onPublish?.({
                scheduleUntilTime: scheduleUntil,
                sourceMode: savedDraft ? "draft" : "auto",
                sourceType: "auto-demand",
                sourceLabel: isJa ? "需要計画プレビューから公開" : "Published from Demand Preview",
                note,
                assignments: rawAssignments,
                basisRows: priorityRows,
              })}
              disabled={publishing || rawAssignments.length === 0}
              className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>publish</span>
              {publishing ? (isJa ? "公開中…" : "Publishing…") : (isJa ? "現場へ公開" : "Publish Schedule")}
            </button>
          </div>
        </div>

        {/* Stale Warning Banner */}
        {isStale && (
          <div className="mt-3 flex items-center gap-2 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="material-symbols-outlined text-amber-600" style={{ fontSize: 16 }}>warning</span>
            <span>
              {isJa
                ? "保存された下書きは古い不足データに基づいています。変更を反映するには再保存または再計算してください。"
                : "Saved preview draft is based on older shortage queue data. Save again to update the baseline."}
            </span>
          </div>
        )}

        {/* KPI Strip */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {isJa ? "不足ライン件数" : "Shortage Lines"}
            </div>
            <div className="mt-1 text-base font-bold text-[var(--text-primary)] font-mono">
              {priorityRows.length.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">{isJa ? "件" : "lines"}</span>
            </div>
          </div>

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {isJa ? "自動計画割当数" : "Planned Assignments"}
            </div>
            <div className="mt-1 text-base font-bold text-[var(--freya-blue)] font-mono">
              {rawAssignments.length.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">{isJa ? "枠" : "slots"}</span>
            </div>
          </div>

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {isJa ? "計画割当数量" : "Scheduled Qty"}
            </div>
            <div className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {(summary.scheduledShortfallQuantity ?? rawAssignments.reduce((s, a) => s + (Number(a.quantity) || 0), 0)).toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">{isJa ? "個" : "pcs"}</span>
            </div>
          </div>

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {isJa ? "未計画残不足" : "Unscheduled Shortfall"}
            </div>
            <div className={`mt-1 text-base font-bold font-mono ${(summary.unscheduledShortfallQuantity || 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {(summary.unscheduledShortfallQuantity || 0).toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">{isJa ? "個" : "pcs"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs: Priority Shortage Table vs Inventory Table ── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-2.5 bg-[var(--surface-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab("priority")}
              className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-colors ${
                activeSubTab === "priority"
                  ? "bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {isJa ? `不足優先順位キュー (${priorityRows.length})` : `Shortage Priority Queue (${priorityRows.length})`}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("inventory")}
              className={`px-3 py-1 rounded-[6px] text-xs font-semibold transition-colors ${
                activeSubTab === "inventory"
                  ? "bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {isJa ? `現在庫スナップショット (${inventoryRows.length})` : `Inventory Snapshot (${inventoryRows.length})`}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{isJa ? "計画終了予定:" : "Schedule Until:"}</span>
            <input
              type="time"
              value={scheduleUntil}
              onChange={(e) => setScheduleUntil(e.target.value)}
              className="h-7 rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text-primary)] font-mono outline-none"
            />
          </div>
        </div>

        <div className="p-4 max-h-[380px] overflow-y-auto">
          {activeSubTab === "priority" ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold w-12 text-center">{isJa ? "優先順" : "Rank"}</th>
                    <th className="px-3 py-2 font-semibold">{isJa ? "依頼番号" : "Request #"}</th>
                    <th className="px-3 py-2 font-semibold">{isJa ? "背番号" : "背番号"}</th>
                    <th className="px-3 py-2 font-semibold">{isJa ? "品番" : "品番"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "不足数量" : "Shortfall Qty"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "不足箱数" : "Boxes"}</th>
                    <th className="px-3 py-2 font-semibold">{isJa ? "割当可能設備" : "Eligible Machines"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]">
                  {priorityRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                        {isJa ? "現在、未充足の不足依頼はありません。" : "No unfinished shortage line items waiting."}
                      </td>
                    </tr>
                  ) : (
                    priorityRows.map((row, index) => (
                      <tr key={row._id || index} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="px-3 py-2 text-center font-mono font-semibold text-[var(--text-secondary)]">
                          {row.priorityRank || index + 1}
                        </td>
                        <td className="px-3 py-2 font-mono font-medium text-[var(--freya-blue)]">
                          {row.requestNumber || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold">{row.背番号 || "—"}</td>
                        <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{row.品番 || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          {Number(row.shortfallQuantity || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--text-secondary)]">
                          {row.shortageBoxes != null ? Number(row.shortageBoxes).toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)] truncate max-w-[200px]">
                          {Array.isArray(row.eligibleMachines) && row.eligibleMachines.length
                            ? row.eligibleMachines.join(", ")
                            : (isJa ? "未指定 / 全台" : "All available")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{isJa ? "背番号" : "背番号"}</th>
                    <th className="px-3 py-2 font-semibold">{isJa ? "品番" : "品番"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "現在庫数 (実数)" : "Physical Stock"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "引当済数" : "Reserved"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "引当可能数" : "Available"}</th>
                    <th className="px-3 py-2 text-right font-semibold">{isJa ? "未充足不足数" : "Shortage"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]">
                  {inventoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                        {isJa ? "対象製品の在庫情報がありません。" : "No inventory data available for current scope."}
                      </td>
                    </tr>
                  ) : (
                    inventoryRows.map((inv, index) => (
                      <tr key={inv._id || index} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="px-3 py-2 font-mono font-semibold text-[var(--freya-blue)]">{inv.背番号 || "—"}</td>
                        <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{inv.品番 || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {Number(inv.physicalQuantity || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--text-secondary)]">
                          {Number(inv.reservedQuantity || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--text-primary)]">
                          {Number(inv.availableQuantity || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          {Number(inv.pendingShortfallQuantity || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Auto-Plan Calendar Grid (Lane Schedule) ── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              {isJa ? "自動計画タイムライン割当プレビュー" : "Planned Preview Timeline Schedule"}
            </h4>
            <p className="text-xs text-[var(--text-secondary)]">
              {isJa
                ? `設備別稼働時間帯 (${scheduleUntil} まで) に沿って自動配置された作業スロットです。`
                : `Simulated assignment blocks scheduled across machine lanes up to ${scheduleUntil}.`}
            </p>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {equipmentList.length} {isJa ? "台の設備" : "machines"} · {rawAssignments.length} {isJa ? "件の計画" : "jobs"}
          </span>
        </div>

        {equipmentList.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-[6px]">
            {isJa ? "自動割当された設備スロットはありません。" : "No machine assignment slots scheduled."}
          </div>
        ) : (
          <div className="space-y-3">
            {equipmentList.map((eq) => {
              const items = assignmentsByEquipment[eq] || [];
              return (
                <div key={eq} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-[var(--text-primary)] font-mono">{eq}</span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      {items.length} {isJa ? "件" : "items"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-0.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 shadow-2xs text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[var(--freya-blue)]">{it.背番号 || it.品番}</span>
                          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                            {Number(it.quantity || 0).toLocaleString()} {isJa ? "個" : "pcs"}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">
                          {it.startTime || "09:00"} → {it.endTime || "—"} ({it.estimatedTime || 0}m)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
