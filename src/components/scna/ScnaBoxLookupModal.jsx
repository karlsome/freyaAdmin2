import { useState } from "react";
import ModalShell from "../ModalShell";
import ScnaProductionDetailModal from "./ScnaProductionDetailModal";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchFreyaTabletData, fetchScnaBox } from "../../services/scnaApi";

const fmtNum = (v) => {
  const n = Number(v);
  return v == null || v === "" || Number.isNaN(n) ? "—" : n.toLocaleString();
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

// Accepts a plain box ID or the whole label QR text ("品番,収容数,lot,WO-9999-B001").
function parseBoxId(text) {
  const parts = String(text || "").split(/[,\s]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1].trim() : "";
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
        {children || "—"}
      </dd>
    </div>
  );
}

export default function ScnaBoxLookupModal({ open, onClose, onViewData }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [recordOpen, setRecordOpen] = useState(false);

  async function handleSearch(e) {
    e?.preventDefault();
    const boxId = parseBoxId(input);
    if (!boxId) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const box = await fetchScnaBox(boxId);
      // Find the production record: by the box's run, else by the box ID inside Box_IDs.
      const search = box?.runId || boxId;
      const res = await fetchFreyaTabletData({ search, limit: 10 });
      const list = Array.isArray(res?.data) ? res.data : [];
      const record =
        list.find((r) => box?.runId && r.Run_ID === box.runId) ||
        list.find((r) => Array.isArray(r.Box_IDs) && r.Box_IDs.includes(boxId)) ||
        null;
      if (!box && !record) {
        setError(isJa ? `箱ID「${boxId}」は見つかりませんでした。` : `Box ID "${boxId}" was not found.`);
      } else {
        setResult({ boxId, box, record });
      }
    } catch (err) {
      setError(err.message || (isJa ? "検索に失敗しました。" : "Lookup failed."));
    } finally {
      setLoading(false);
    }
  }

  const box = result?.box;
  const record = result?.record;
  const workOrder = box?.workOrderNumber || record?.WorkOrder_Info?.workOrderNumber || "";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={isJa ? "SCNA トレーサビリティ" : "SCNA Traceability"}
      title={isJa ? "箱ID検索" : "Box ID Lookup"}
      subtitle={isJa ? "箱IDまたはラベルQRの内容を入力" : "Enter a box ID or the label QR text"}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!result}
            onClick={() => onViewData?.({ search: result?.boxId, date: record?.Date || "" })}
            className="h-9 rounded-[6px] bg-[var(--freya-blue)] px-4 text-xs font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
          >
            {isJa ? "データを見る" : "View Data"}
          </button>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
        >
          {isJa ? "閉じる" : "Close"}
        </button>
        </div>
      }
    >
      <div className="max-h-[78vh] space-y-5 overflow-y-auto p-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="WO-9999-B001"
            className="h-9 flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-sm text-[var(--text-primary)]"
          />
          <button
            type="submit"
            disabled={loading || !parseBoxId(input)}
            className="h-9 rounded-[6px] bg-[var(--freya-blue)] px-4 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading ? (isJa ? "検索中…" : "Searching…") : isJa ? "検索" : "Search"}
          </button>
        </form>

        {error && (
          <div className="rounded-[6px] border border-rose-500/30 bg-rose-500/[0.06] p-3 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {result && (
          <>
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <h4 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
                {isJa ? "箱 " : "Box "}
                <span className="font-mono">{result.boxId}</span>
              </h4>
              {box ? (
                <>
                  <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-3">
                    <Field label="品番">{box["品番"]}</Field>
                    <Field label="背番号">{box["背番号"]}</Field>
                    <Field label="収容数 (label)">{fmtNum(box.qtyLabel)}</Field>
                    <Field label={isJa ? "箱内の実数" : "Measured pcs in box"}>{fmtNum(box.qtyMeasured)}</Field>
                    <Field label="Worker">{box.worker}</Field>
                    <Field label="Machines">{(box.machines || []).join(", ")}</Field>
                    <Field label="Work order">
                      {workOrder && record ? (
                        <button
                          type="button"
                          onClick={() => setRecordOpen(true)}
                          title={isJa ? "生産記録を表示" : "View production record"}
                          className="font-mono font-semibold text-[var(--freya-blue)] underline decoration-dotted underline-offset-2 hover:opacity-80"
                        >
                          {workOrder}
                        </button>
                      ) : (
                        workOrder
                      )}
                    </Field>
                    <Field label="Printed">{fmtTime(box.printedAt || box.finishedAt)}</Field>
                    <Field label="Run ID">{box.runId}</Field>
                  </div>
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-[11px] text-[var(--text-muted)]">
                          <th className="py-2 pr-3 font-medium">Machine</th>
                          <th className="py-2 pr-3 font-medium">Lot</th>
                          <th className="py-2 pr-3 text-right font-medium">Shots</th>
                          <th className="py-2 pr-3 text-right font-medium">Pieces</th>
                          <th className="py-2 pr-3 font-medium">First cycle</th>
                          <th className="py-2 font-medium">Last cycle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(box.lots || []).map((l, i) => (
                          <tr key={i} className="border-b border-[var(--border)]/60 last:border-0">
                            <td className="py-2 pr-3">
                              {l.source === "spare" ? (isJa ? "スペア" : "Spare") : l.machine || "—"}
                            </td>
                            <td className="py-2 pr-3 font-mono font-semibold">{l.lotNumber || "—"}</td>
                            <td className="py-2 pr-3 text-right font-mono">{fmtNum(l.shots)}</td>
                            <td className="py-2 pr-3 text-right font-mono font-semibold">{fmtNum(l.pieces)}</td>
                            <td className="py-2 pr-3 font-mono">{fmtTime(l.firstCycleAt)}</td>
                            <td className="py-2 font-mono">{fmtTime(l.lastCycleAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">
                  {isJa
                    ? "この箱IDの詳細は保存されていません（生産記録のみ）。"
                    : "No box detail is stored for this ID (production record only)."}
                </p>
              )}
            </div>

            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
              {record ? (
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {isJa ? "生産記録" : "Production record"}
                    </span>
                    {" · "}
                    {record["設備"]} · {record.Date} · {record.Worker_Name}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecordOpen(true)}
                    className="h-8 rounded-[6px] bg-[var(--freya-blue)] px-3 text-xs font-semibold text-white"
                  >
                    {isJa ? "生産記録を開く" : "Open production record"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">
                  {isJa
                    ? "この箱の生産記録はまだ提出されていません（ランが終了していない可能性があります）。"
                    : "No production record yet for this box (the run may not be submitted)."}
                </p>
              )}
            </div>
          </>
        )}
      </div>
      <ScnaProductionDetailModal
        open={recordOpen && Boolean(record)}
        record={record}
        onClose={() => setRecordOpen(false)}
      />
    </ModalShell>
  );
}
