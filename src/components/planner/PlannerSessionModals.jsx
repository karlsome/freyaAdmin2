import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchPlannerSessionLogs } from "../../services/plannerApi";

const dash = (value) => (value === undefined || value === null || value === "" ? "-" : value);

function Field({ label, children, mono = false }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold text-[var(--text-primary)] ${mono ? "font-mono" : ""}`}>{children}</div>
    </div>
  );
}

// Click on an "Actual" block: every press record that makes up the block.
export function PlannerActualProductionModal({ block, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  if (!block) return null;

  const records = block.records || [];
  const first = records[0] || {};
  const totalQuantity = records.reduce((sum, r) => sum + (Number(r.Process_Quantity) || 0), 0);
  const totalNg = records.reduce((sum, r) => sum + (Number(r.Total_NG) || 0), 0);

  const tiles = (record) => [
    [isJa ? "数量" : "Quantity", record.Process_Quantity, "text-sky-700 dark:text-sky-300 bg-sky-500/10"],
    [isJa ? "不良数" : "NG", record.Total_NG, "text-rose-700 dark:text-rose-300 bg-rose-500/10"],
    ["Total", record.Total, "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"],
    ["Spare", record.Spare, "text-violet-700 dark:text-violet-300 bg-violet-500/10"],
  ];

  return (
    <PlannerModalShell
      open
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
      title={`${dash(first.品番 || block.品番)} · ${dash(block.背番号)}`}
      subtitle={`${dash(first.工場)} · ${dash(first.Date)}`}
    >
      <div className="grid grid-cols-2 gap-3 rounded-[8px] bg-[var(--surface-subtle)] p-3 sm:grid-cols-4">
        <Field label={isJa ? "設備" : "Equipment"}>{dash(block.equipment)}</Field>
        <Field label={isJa ? "背番号" : "背番号"} mono>{dash(block.背番号)}</Field>
        <Field label={isJa ? "合計数量" : "Total Quantity"} mono>{totalQuantity.toLocaleString()}</Field>
        <Field label={isJa ? "合計不良" : "Total NG"} mono>{totalNg.toLocaleString()}</Field>
      </div>

      <h4 className="mt-5 text-sm font-semibold text-[var(--text-primary)]">
        {isJa ? `生産記録 (${records.length})` : `Production Records (${records.length})`}
      </h4>
      <div className="mt-2 space-y-3">
        {records.map((record, index) => {
          const images = [
            [isJa ? "初物チェック" : "First-piece check", record.初物チェック画像],
            [isJa ? "終物チェック" : "Last-piece check", record.終物チェック画像],
            [isJa ? "材料ラベル" : "Material label", Array.isArray(record.materialLabelImages) ? record.materialLabelImages[0] : null],
          ].filter(([, src]) => src);

          return (
            <div key={record._id || index} className="rounded-[8px] border border-[var(--border)] p-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label={isJa ? "作業者" : "Worker"}>{dash(record.Worker_Name)}</Field>
                <Field label={isJa ? "設備" : "Equipment"}>{dash(record.設備)}</Field>
                <Field label={isJa ? "時間" : "Time"} mono>{dash(record.Time_start)} - {dash(record.Time_end)}</Field>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {tiles(record).map(([label, value, tone]) => (
                  <div key={label} className={`rounded-[6px] p-2 ${tone}`}>
                    <div className="text-[10px] font-semibold uppercase">{label}</div>
                    <div className="font-mono text-lg font-bold">{dash(value)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                <Field label={isJa ? "材料ロット" : "Material Lot"}>{dash(record.材料ロット)}</Field>
                <Field label="Cycle Time">{record.Cycle_Time ? `${record.Cycle_Time}s` : "-"}</Field>
                <Field label={isJa ? "ショット数" : "Shots"}>{dash(record.ショット数)}</Field>
                <Field label={isJa ? "疵引不良" : "Scratch NG"}>{record.疵引不良 || 0}</Field>
                <Field label={isJa ? "加工不良" : "Process NG"}>{record.加工不良 || 0}</Field>
                <Field label={isJa ? "その他" : "Other"}>{record.その他 || 0}</Field>
              </div>

              {record.Comment ? (
                <div className="mt-3 rounded-[6px] bg-[var(--surface-subtle)] p-2 text-xs text-[var(--text-primary)]">{record.Comment}</div>
              ) : null}

              {images.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {images.map(([label, src]) => (
                    <a key={label} href={src} target="_blank" rel="noreferrer" className="block">
                      <div className="mb-1 text-[10px] text-[var(--text-muted)]">{label}</div>
                      <img src={src} alt={label} className="h-28 w-full rounded-[6px] object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </PlannerModalShell>
  );
}

// Click on an amber "in progress" cell: the tablet session's event log.
export function PlannerInProgressModal({ target, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [state, setState] = useState({ loading: true, records: [], error: "" });
  const sessionID = target?.session?.sessionID;

  useEffect(() => {
    let cancelled = false;
    fetchPlannerSessionLogs(sessionID)
      .then((records) => { if (!cancelled) setState({ loading: false, records, error: records.length ? "" : (isJa ? "セッションデータが見つかりません" : "No session data found") }); })
      .catch(() => { if (!cancelled) setState({ loading: false, records: [], error: isJa ? "セッション詳細の取得に失敗しました" : "Failed to load session details" }); });
    return () => { cancelled = true; };
  }, [sessionID, isJa]);

  if (!target) return null;

  const { records } = state;
  const first = records[0];
  const last = records[records.length - 1];
  const worker = records.reduce(
    (found, record) => found || record.AdditionalData?.workerName || record.AdditionalData?.WorkerName || "",
    "",
  ) || first?.作業者名 || first?.Worker || "-";
  const minutes = first && last ? Math.round((new Date(last.Timestamp) - new Date(first.Timestamp)) / 60000) : 0;
  const fmt = (value) => new Date(value).toLocaleString("ja-JP");

  return (
    <PlannerModalShell
      open
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
      title={isJa ? "進行中セッション詳細" : "In-Progress Session Details"}
      subtitle={isJa ? `クリックした時間枠: ${target.slot}` : `Clicked time slot: ${target.slot}`}
    >
      {state.loading ? (
        <div className="py-10 text-center text-xs text-[var(--text-muted)]">{isJa ? "読み込み中…" : "Loading…"}</div>
      ) : state.error ? (
        <div className="py-10 text-center text-xs text-[var(--status-danger)]">{state.error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 rounded-[8px] bg-[var(--surface-subtle)] p-3 sm:grid-cols-4">
            <Field label={isJa ? "設備" : "Equipment"}>{target.equipment}</Field>
            <Field label="背番号" mono>{dash(first.背番号)}</Field>
            <Field label="品番" mono>{dash(first.品番)}</Field>
            <Field label={isJa ? "作業者" : "Worker"}>{worker}</Field>
            <Field label={isJa ? "開始" : "Session Start"}>{fmt(first.Timestamp)}</Field>
            <Field label={isJa ? "最終アクティビティ" : "Last Activity"}>{fmt(last.Timestamp)}</Field>
            <Field label={isJa ? "経過時間" : "Duration"}>{minutes} {isJa ? "分" : "min"}</Field>
            <Field label="Session ID" mono><span className="break-all text-xs">{sessionID}</span></Field>
          </div>

          <h4 className="mt-5 text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? `アクティビティ (${records.length} 件)` : `Activity Timeline (${records.length} events)`}
          </h4>
          <div className="mt-2 divide-y divide-[var(--border)] rounded-[8px] border border-[var(--border)]">
            {records.map((record, index) => (
              <div key={record._id || index} className="flex gap-3 px-3 py-2">
                <div className="w-20 shrink-0 font-mono text-xs text-[var(--text-muted)]">{new Date(record.Timestamp).toLocaleTimeString("ja-JP")}</div>
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{record.Action || (isJa ? "アクティビティ" : "Activity")}</div>
                  {record.Status ? <div className="mt-0.5 text-xs text-[var(--text-secondary)]">Status: {record.Status}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </PlannerModalShell>
  );
}
