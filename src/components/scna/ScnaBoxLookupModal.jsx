import { useState } from "react";
import ModalShell from "../ModalShell";
import ScnaProductionDetailModal from "./ScnaProductionDetailModal";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchFreyaTabletData, fetchScnaBox, fetchScnaBoxesByLot, fetchScnaLabelChain } from "../../services/scnaApi";

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

// SRS labels end in -S001, Kensa labels in -K001; everything else is a press (DCP) box ID.
function labelKind(boxId) {
  if (/-S\d+$/i.test(boxId)) return "srs";
  if (/-K\d+$/i.test(boxId)) return "kensa";
  return "press";
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

// Result card for an SRS or Kensa label: the label, its lines, the drafts it replaced and the submitted records.
function LabelResult({ result, isJa, onOpen }) {
  const { kind, boxId, label } = result;
  const { box, parents = [], srsBoxes = [], srsRecords = [], kensaRecords = [] } = label;
  const records = kind === "srs" ? srsRecords : kensaRecords;
  const kindName = kind === "srs" ? "SRS" : "Kensa";
  const idLink = (id) => (
    <button
      type="button"
      onClick={() => onOpen(id)}
      className="font-mono font-semibold text-[var(--freya-blue)] underline decoration-dotted underline-offset-2"
    >
      {id}
    </button>
  );
  const lineSource = (l) => (l.boxId ? idLink(l.boxId) : l.srsId ? idLink(l.srsId) : l.legacy ? (isJa ? "旧データ" : "Legacy") : "—");
  return (
    <>
      <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <h4 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
          {kindName} {isJa ? "ラベル " : "label "}
          <span className="font-mono">{boxId}</span>
          {box.status && (
            <span className="ml-2 rounded-[4px] bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] font-medium">{box.status}</span>
          )}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-3">
          <Field label="品番">{box["品番"]}</Field>
          <Field label="背番号">{box["背番号"]}</Field>
          <Field label="収容数 (label)">{fmtNum(box.qtyLabel)}</Field>
          <Field label={isJa ? "箱内の実数" : "Measured pcs in box"}>{fmtNum(box.qtyMeasured)}</Field>
          <Field label="Machine">{box.machine}{box.lane ? ` / ${box.lane}` : ""}</Field>
          <Field label="Workers">{box.workers}</Field>
          {kind === "srs" && <Field label="Work order">{box.workOrder}</Field>}
          <Field label="Printed">{fmtTime(box.printedAt)}</Field>
          {box.parentSrsId || box.parentKensaId ? (
            <Field label={isJa ? "前のドラフト" : "Resumed from"}>{box.parentSrsId || box.parentKensaId}</Field>
          ) : null}
        </div>
        {(box.lines || []).length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] text-[var(--text-muted)]">
                  <th className="py-2 pr-3 font-medium">{isJa ? "元の箱" : "Source"}</th>
                  <th className="py-2 pr-3 text-right font-medium">Good</th>
                  <th className="py-2 pr-3 text-right font-medium">NG</th>
                  <th className="py-2 font-medium">Lots</th>
                </tr>
              </thead>
              <tbody>
                {box.lines.map((l, i) => (
                  <tr key={i} className="border-b border-[var(--border)]/60 last:border-0">
                    <td className="py-2 pr-3">{lineSource(l)}{l.carried ? " ↩" : ""}</td>
                    <td className="py-2 pr-3 text-right font-mono font-semibold">{fmtNum(l.good)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{fmtNum(l.ngTotal)}</td>
                    <td className="py-2 font-mono">
                      {(l.lots || l.lotDetails || []).map((x) => (typeof x === "string" ? x : x.lotNumber)).filter(Boolean).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {kind === "kensa" && srsBoxes.length > 0 && (
          <p className="mt-4 text-xs text-[var(--text-secondary)]">
            {isJa ? "SRSラベル: " : "SRS labels: "}
            {srsBoxes.map((b) => <span key={b.srsId} className="mr-2">{idLink(b.srsId)}</span>)}
          </p>
        )}
        {parents.length > 0 && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            {isJa ? "置き換えたドラフト: " : "Replaced drafts: "}
            {parents.map((p) => (
              <span key={p.srsId || p.kensaId} className="mr-2 font-mono">{p.srsId || p.kensaId}</span>
            ))}
          </p>
        )}
      </div>
      <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
          {isJa ? "提出済み記録" : "Submitted records"} ({records.length})
        </h4>
        {records.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            {isJa ? "このラベルの提出記録はまだありません。" : "No submitted record uses this label yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] text-[var(--text-muted)]">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">設備</th>
                  <th className="py-2 pr-3 font-medium">背番号</th>
                  <th className="py-2 pr-3 font-medium">Worker</th>
                  <th className="py-2 pr-3 text-right font-medium">Total</th>
                  <th className="py-2 pr-3 text-right font-medium">NG</th>
                  <th className="py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={String(r._id)} className="border-b border-[var(--border)]/60 last:border-0">
                    <td className="py-2 pr-3 font-mono">{r.Date || "—"}</td>
                    <td className="py-2 pr-3">{r["設備"] || "—"}</td>
                    <td className="py-2 pr-3 font-mono">{r["背番号"] || "—"}</td>
                    <td className="py-2 pr-3">{r.Worker_Name || "—"}</td>
                    <td className="py-2 pr-3 text-right font-mono font-semibold">{fmtNum(r.Total ?? r.Process_Quantity)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{fmtNum(r.Total_NG)}</td>
                    <td className="py-2 font-mono">{[r.Time_start, r.Time_end].filter(Boolean).join(" – ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
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
  const [mode, setMode] = useState("box"); // "box" | "lot"
  const [lotResult, setLotResult] = useState(null); // { lot, boxes }
  const [copied, setCopied] = useState(false);

  async function searchLot() {
    const lot = input.trim();
    if (!lot) return;
    setLoading(true);
    setError("");
    setResult(null);
    setLotResult(null);
    try {
      const boxes = await fetchScnaBoxesByLot(lot);
      setLotResult({ lot, boxes });
    } catch (err) {
      setError(err.message || (isJa ? "検索に失敗しました。" : "Lookup failed."));
    } finally {
      setLoading(false);
    }
  }

  async function searchBoxId(idText, fromLot = false) {
    const boxId = parseBoxId(idText);
    if (!boxId) return;
    if (!fromLot) setLotResult(null);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const kind = labelKind(boxId);
      if (kind !== "press") {
        const chain = await fetchScnaLabelChain(kind, boxId);
        if (chain) {
          setResult({ boxId, kind, label: chain });
          return;
        }
        // not a registered label: fall through to the press-box / production-record lookup
      }
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

  function handleSearch(e) {
    e?.preventDefault();
    if (mode === "lot") searchLot();
    else searchBoxId(input);
  }

  function switchMode(next) {
    setMode(next);
    setInput("");
    setError("");
    setResult(null);
    setLotResult(null);
  }

  function lotLinesOf(b) {
    return (b.lots || []).filter((l) => l.lotNumber === lotResult?.lot);
  }

  async function copyBoxIds() {
    const ids = (lotResult?.boxes || []).map((b) => b.boxId).join("\n");
    try {
      await navigator.clipboard.writeText(ids);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the IDs are still visible in the table
    }
  }

  const label = result?.label;
  const box = result?.box;
  const record = result?.record;
  const workOrder = box?.workOrderNumber || record?.WorkOrder_Info?.workOrderNumber || "";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={isJa ? "SCNA トレーサビリティ" : "SCNA Traceability"}
      title={isJa ? "箱ID検索" : "Box ID Lookup"}
      subtitle={mode === "lot" ? (isJa ? "材料ロット番号から影響のある箱を検索" : "Find every box that contains a material lot") : (isJa ? "箱IDまたはラベルQRの内容を入力" : "Enter a box ID or the label QR text")}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!result || Boolean(label)}
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
        <div className="inline-flex rounded-[6px] border border-[var(--border)] p-0.5 text-xs font-semibold">
          {[
            ["box", isJa ? "箱ID" : "Box ID"],
            ["lot", isJa ? "材料ロット" : "Lot number"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              className={`h-7 rounded-[4px] px-3 transition ${
                mode === key
                  ? "bg-[var(--freya-blue)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "lot" ? "88888-2" : "WO-9999-B001"}
            className="h-9 flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-sm text-[var(--text-primary)]"
          />
          <button
            type="submit"
            disabled={loading || (mode === "lot" ? !input.trim() : !parseBoxId(input))}
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

        {lotResult && (
          <div className="rounded-[8px] border border-amber-500/25 bg-amber-500/[0.06] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {isJa ? "ロット " : "Lot "}
                <span className="font-mono">{lotResult.lot}</span>
                {" — "}
                {isJa ? `${lotResult.boxes.length} 箱` : `${lotResult.boxes.length} box(es)`}
                {lotResult.boxes.length > 0 && (
                  <span className="ml-2 font-mono text-xs font-normal">
                    {fmtNum(lotResult.boxes.reduce((sum, b) => sum + lotLinesOf(b).reduce((a, l) => a + (Number(l.pieces) || 0), 0), 0))}{" "}
                    pcs
                  </span>
                )}
              </h4>
              {lotResult.boxes.length > 0 && (
                <button
                  type="button"
                  onClick={copyBoxIds}
                  className="h-7 rounded-[6px] border border-amber-500/30 px-3 text-xs font-semibold text-amber-900 dark:text-amber-200"
                >
                  {copied ? (isJa ? "コピーしました" : "Copied") : isJa ? "箱IDをコピー" : "Copy box IDs"}
                </button>
              )}
            </div>
            {lotResult.boxes.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                {isJa
                  ? "このロットを含む箱は見つかりませんでした。箱ID機能の導入前の生産分は含まれません。"
                  : "No boxes contain this lot. Production from before box IDs were introduced is not included."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-amber-500/20 text-left text-[11px] text-amber-700 dark:text-amber-400">
                      <th className="py-2 pr-3 font-medium">Box ID</th>
                      <th className="py-2 pr-3 font-medium">背番号</th>
                      <th className="py-2 pr-3 font-medium">Machine</th>
                      <th className="py-2 pr-3 text-right font-medium">Pcs of this lot</th>
                      <th className="py-2 pr-3 text-right font-medium">Box total</th>
                      <th className="py-2 font-medium">Printed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotResult.boxes.map((b) => {
                      const lines = lotLinesOf(b);
                      return (
                        <tr key={b.boxId} className="border-b border-amber-500/10 last:border-0">
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              onClick={() => searchBoxId(b.boxId, true)}
                              className="font-mono font-semibold text-[var(--freya-blue)] underline decoration-dotted underline-offset-2"
                            >
                              {b.boxId}
                            </button>
                          </td>
                          <td className="py-2 pr-3 font-mono">{b["背番号"] || "—"}</td>
                          <td className="py-2 pr-3">
                            {lines.map((l) => (l.source === "spare" ? (isJa ? "スペア" : "Spare") : l.machine)).join(", ") || "—"}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono font-semibold">
                            {fmtNum(lines.reduce((a, l) => a + (Number(l.pieces) || 0), 0))}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">{fmtNum(b.qtyMeasured)}</td>
                          <td className="py-2 font-mono">{fmtTime(b.printedAt || b.finishedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {label && <LabelResult result={result} isJa={isJa} onOpen={(id) => searchBoxId(id, true)} />}

        {result && !label && (
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
