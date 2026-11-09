import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PlannerPublishedTab({
  publishedData,
  loading = false,
  restoring = false,
  factoryName,
  planDate,
  onRefresh,
  onOpenPreview,
  onRestoreVersion,
  onPrint,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const renderT0Ref = useRef(performance.now());
  renderT0Ref.current = performance.now();

  const [selectedVersionId, setSelectedVersionId] = useState("");

  console.log(`⏱️ [PlannerPublishedTab] Rendering published tab (loading=${loading})`);

  useEffect(() => {
    console.log(`✅ [PlannerPublishedTab] Rendered to DOM in ${(performance.now() - renderT0Ref.current).toFixed(1)}ms`);
  });

  if (!factoryName) {
    return (
      <div className="freya-card rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center text-[var(--text-muted)]">
        <span className="material-symbols-outlined text-4xl text-[var(--freya-blue)] mb-2">broadcast_on_home</span>
        <p className="text-base font-semibold text-[var(--text-primary)]">
          {isJa ? "工場を選択してください" : "Select a factory"}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {isJa ? "現場オペレーター向けの確定済み（凍結）スケジュールを閲覧・管理します。" : "View and manage frozen releases for the factory floor."}
        </p>
      </div>
    );
  }

  if (loading && !publishedData) {
    return (
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {isJa ? "公開スケジュールを読み込み中…" : "Loading published schedule…"}
        </p>
      </div>
    );
  }

  const activeVersion = publishedData?.activeVersion || null;
  const versions = Array.isArray(publishedData?.versions) ? publishedData.versions : [];

  const viewedVersion = (selectedVersionId && versions.find((v) => String(v.id || v._id) === String(selectedVersionId)))
    || activeVersion
    || (versions.length ? versions[0] : null);

  const isViewingHistorical = viewedVersion && activeVersion && String(viewedVersion.id || viewedVersion._id) !== String(activeVersion.id || activeVersion._id);
  const assignments = Array.isArray(viewedVersion?.assignments) ? viewedVersion.assignments : [];

  // Group assignments by equipment
  const assignmentsByEquipment = {};
  assignments.forEach((item) => {
    const eq = item.equipment || "Other";
    if (!assignmentsByEquipment[eq]) assignmentsByEquipment[eq] = [];
    assignmentsByEquipment[eq].push(item);
  });
  const equipmentList = Object.keys(assignmentsByEquipment).sort();

  if (!activeVersion && !versions.length) {
    return (
      <div className="freya-card rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center text-[var(--text-muted)]">
        <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">schedule_send</span>
        <p className="text-base font-semibold text-[var(--text-primary)]">
          {isJa ? "公開スケジュールはまだありません" : "No published schedule yet"}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {isJa
            ? "需要計画プレビューで計画を確定し、「現場へ公開」をクリックするとここに凍結バージョンが作成されます。"
            : "Review the plan in the Preview tab and click 'Publish Schedule' to freeze the first release for the factory floor."}
        </p>
        <button
          type="button"
          onClick={onOpenPreview}
          className="mt-4 inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>radar</span>
          {isJa ? "プレビューを開く" : "Open Preview"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Top Header & Actions ── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {isJa ? "現場公開スケジュール（確定版）" : "Published Schedule for Shop Floor"}
              </h3>
              {viewedVersion && (
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  isViewingHistorical
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                }`}>
                  {isJa ? `第 ${viewedVersion.version || 1} 版` : `Version ${viewedVersion.version || 1}`}
                  {isViewingHistorical ? (isJa ? " (過去履歴)" : " (Historical)") : (isJa ? " (現在稼働中)" : " (Active)")}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {viewedVersion?.publishedAt
                ? (isJa
                    ? `公開日時: ${new Date(viewedVersion.publishedAt).toLocaleString("ja-JP")} (${viewedVersion.publishedBy || "system"})`
                    : `Published: ${new Date(viewedVersion.publishedAt).toLocaleString()} by ${viewedVersion.publishedBy || "system"}`)
                : (isJa ? "現場への確定公開バージョンです。" : "Frozen release version for shop floor operations.")}
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
              {isJa ? "更新" : "Refresh"}
            </button>

            {isViewingHistorical && (
              <button
                type="button"
                onClick={() => onRestoreVersion?.(viewedVersion.version)}
                disabled={restoring}
                className="flex items-center gap-1.5 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>history</span>
                {restoring ? (isJa ? "復元中…" : "Restoring…") : (isJa ? `第 ${viewedVersion.version} 版に復元` : `Restore Version ${viewedVersion.version}`)}
              </button>
            )}

            <button
              type="button"
              onClick={onPrint}
              disabled={assignments.length === 0}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>print</span>
              {isJa ? "印刷" : "Print"}
            </button>

            <button
              type="button"
              onClick={onOpenPreview}
              className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit_calendar</span>
              {isJa ? "プレビューで改訂" : "Revise in Preview"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Version Selector Bar ── */}
      {versions.length > 1 && (
        <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] flex-shrink-0">
              {isJa ? "バージョン履歴:" : "Versions:"}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {versions.map((v) => {
                const isSelected = String(v.id || v._id) === String(viewedVersion?.id || viewedVersion?._id);
                const isActive = String(v.id || v._id) === String(activeVersion?.id || activeVersion?._id);
                return (
                  <button
                    key={v.id || v._id}
                    type="button"
                    onClick={() => setSelectedVersionId(String(v.id || v._id))}
                    className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold transition-colors flex items-center gap-1 ${
                      isSelected
                        ? "bg-[var(--freya-blue)] text-white"
                        : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]"
                    }`}
                  >
                    <span>{isJa ? `第 ${v.version} 版` : `v${v.version}`}</span>
                    {isActive && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-emerald-500"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <span className="text-xs font-mono text-[var(--text-muted)] flex-shrink-0">
            {assignments.length} {isJa ? "件の確定作業" : "jobs scheduled"}
          </span>
        </div>
      )}

      {/* ── Published Schedule Machine Lanes ── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              {isJa ? "確定スケジュール（設備別レーン）" : "Frozen Equipment Schedule Lanes"}
            </h4>
            <p className="text-xs text-[var(--text-secondary)]">
              {isJa ? "現場で順守される確定された生産指示順序です。" : "Official production schedule sequence followed on the factory floor."}
            </p>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {equipmentList.length} {isJa ? "台の設備稼働" : "active machines"}
          </span>
        </div>

        {equipmentList.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-[6px]">
            {isJa ? "このバージョンには割当作業がありません。" : "No jobs scheduled in this version."}
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
                      {items.length} {isJa ? "工程" : "jobs"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-0.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-2xs text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[var(--freya-blue)]">{it.背番号 || it.品番}</span>
                          <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)]">
                            {Number(it.quantity || 0).toLocaleString()} {isJa ? "個" : "pcs"}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">
                          {it.startTime || "09:00"} → {it.endTime || "—"} ({it.estimatedTime || 0}m)
                        </div>
                        {it.品番 && it.品番 !== it.背番号 && (
                          <div className="text-[10px] font-mono text-[var(--text-muted)] truncate max-w-[140px]">
                            {it.品番}
                          </div>
                        )}
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
