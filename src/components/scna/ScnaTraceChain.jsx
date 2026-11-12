import { useMemo, useState } from "react";

// Process tiers, earliest first. Legacy (unlabelled) inputs sit in the press tier.
const TIER = { legacy: 0, press: 0, srs: 1, kensa: 2 };
const KIND_META = {
  press: { name: "Press", dot: "bg-emerald-400", record: "Press" },
  srs: { name: "SRS", dot: "bg-slate-400", record: "SRS" },
  kensa: { name: "Kensa", dot: "bg-amber-400", record: "Kensa" },
  legacy: { name: "Legacy", dot: "bg-zinc-400", record: null },
};

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

// ids reachable from rootId through `key` ("parents" = earlier processes, "children" = later ones)
function reach(byId, rootId, key) {
  const seen = new Set();
  const stack = [...(byId.get(rootId)?.[key] || [])];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)[key] || []));
  }
  return seen;
}

function lotsOf(node) {
  const L = node.label || {};
  if (node.kind === "press") return (L.lots || []).map((l) => l.lotNumber).filter(Boolean);
  if (node.kind === "legacy") return [L.lotNumber].filter(Boolean);
  const rec = node.records?.[0];
  if (rec?.Lot_Details?.length) return [...new Set(rec.Lot_Details.flatMap((d) => d.lots || []))];
  return String(rec?.製造ロット || rec?.材料ロット || "")
    .split(/[,\s]+/)
    .filter(Boolean);
}

function Cell({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 break-words font-mono text-xs font-semibold text-[var(--text-primary)]">{children || "—"}</dd>
    </div>
  );
}

function WorkOrderLink({ number, onOpen }) {
  if (!number) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(number)}
      className="font-mono text-xs font-semibold text-[var(--freya-blue)] underline decoration-dotted underline-offset-2 hover:opacity-80"
    >
      {number}
    </button>
  );
}

// "Void label" for a Kensa label that was only a print test: asks for a reason, then voids it (pieces go back to the source box).
function VoidLabel({ node, isJa, onVoid }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function run() {
    setBusy(true);
    setErr("");
    try {
      await onVoid(node.id, reason.trim() || "print test");
    } catch (e) {
      setErr(e.message || (isJa ? "無効化に失敗しました。" : "Void failed."));
      setBusy(false);
    }
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-7 rounded-[6px] border border-red-500/60 px-3 text-[11px] font-semibold text-red-500 transition hover:bg-red-500/10"
      >
        {isJa ? "ラベルを無効化" : "Void label"}
      </button>
    );
  }
  return (
    <div className="w-full space-y-2 rounded-[6px] border border-red-500/50 bg-red-500/5 p-3 text-xs">
      <p className="font-semibold text-[var(--text-primary)]">
        {isJa
          ? `${node.id} を無効にします。使用した個数は元の箱に戻ります。印刷済みのラベルは廃棄してください。`
          : `Void ${node.id}? The pieces it used go back to the source box. The printed label must be thrown away.`}
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={isJa ? "理由（例: 印刷テスト）" : "Reason (e.g. print test)"}
        className="h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
      />
      {err && <p className="font-semibold text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={run}
          className="h-7 rounded-[6px] bg-red-600 px-3 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? (isJa ? "処理中…" : "Voiding…") : isJa ? "無効にする" : "Void it"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => { setOpen(false); setErr(""); }}
          className="h-7 rounded-[6px] border border-[var(--border)] px-3 text-[11px] font-semibold"
        >
          {isJa ? "キャンセル" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

function NodeCard({ node, isRoot, isJa, onOpenRecord, onOpenWorkOrder, onVoidLabel }) {
  const meta = KIND_META[node.kind];
  const L = node.label || {};
  const lots = lotsOf(node);
  const rec = node.records?.[0];
  const status = L.status && L.status !== "complete" ? L.status : null;

  return (
    <div
      className={`w-full rounded-[8px] border p-4 ${
        isRoot
          ? "border-[var(--freya-blue)] bg-[var(--freya-blue)]/[0.07] ring-1 ring-[var(--freya-blue)]/40"
          : "border-[var(--border)] bg-[var(--surface-hover)]/60"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{meta.name}</span>
        {isRoot && (
          <span className="rounded-[4px] bg-[var(--freya-blue)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {isJa ? "検索" : "Searched"}
          </span>
        )}
        {status && (
          <span className="rounded-[4px] bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] font-medium">{status}</span>
        )}
      </div>

      {node.kind === "legacy" ? (
        <>
          <h5 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "ラベルなし（旧データ）" : "No label (legacy)"}
          </h5>
          <dl className="grid grid-cols-3 gap-3">
            <Cell label="Good">{fmtNum(L.good)}</Cell>
            <Cell label="NG">{fmtNum(L.ngTotal)}</Cell>
            <Cell label="Lots">{lots.join(", ")}</Cell>
          </dl>
        </>
      ) : (
        <>
          <h5 className="mb-3 break-all font-mono text-sm font-semibold text-[var(--text-primary)]">{node.id}</h5>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
            <Cell label="品番">{L.品番 || rec?.品番}</Cell>
            <Cell label="背番号">{L.背番号 || rec?.背番号}</Cell>
            <Cell label={isJa ? "設備" : "Machine"}>
              {node.kind === "press" ? (L.machines || []).join(", ") || rec?.設備 : L.machine || rec?.設備}
            </Cell>
            <Cell label={isJa ? "ラベル数 / 実数" : "Label / measured"}>
              {fmtNum(L.qtyLabel)} / {fmtNum(L.qtyMeasured)}
            </Cell>
            <Cell label="Worker">{node.kind === "press" ? L.worker || rec?.Worker_Name : L.workers || rec?.Worker_Name}</Cell>
            <Cell label="Printed">{fmtTime(L.printedAt || L.finishedAt)}</Cell>
            <Cell label="Lots">{lots.join(", ")}</Cell>
            {node.kind === "srs" && <Cell label="Work order"><WorkOrderLink number={L.workOrder} onOpen={onOpenWorkOrder} /></Cell>}
            {node.kind === "press" && <Cell label="Work order"><WorkOrderLink number={L.workOrderNumber} onOpen={onOpenWorkOrder} /></Cell>}
            {rec && <Cell label={isJa ? "サイクル" : "Cycle time"}>{rec.Cycle_Time != null ? `${rec.Cycle_Time}s` : ""}</Cell>}
          </dl>

          {isRoot && node.kind !== "press" && (L.lines || []).length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] text-[var(--text-muted)]">
                    <th className="py-1.5 pr-3 font-medium">{isJa ? "元の箱" : "Source"}</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Good</th>
                    <th className="py-1.5 pr-3 text-right font-medium">NG</th>
                    <th className="py-1.5 font-medium">Lots</th>
                  </tr>
                </thead>
                <tbody>
                  {L.lines.map((l, i) => (
                    <tr key={i} className="border-b border-[var(--border)]/60 last:border-0">
                      <td className="py-1.5 pr-3 font-mono">
                        {l.boxId || l.srsId || (isJa ? "（ラベルなし）" : "(no label)")}
                        {l.carried ? " ↩" : ""}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono font-semibold">{fmtNum(l.good)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">{fmtNum(l.ngTotal)}</td>
                      <td className="py-1.5 font-mono">{l.lotNumber || (l.lotNumbers || []).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isRoot && node.kind === "press" && (L.lots || []).length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] text-[var(--text-muted)]">
                    <th className="py-1.5 pr-3 font-medium">Machine</th>
                    <th className="py-1.5 pr-3 font-medium">Lot</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Shots</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Pieces</th>
                    <th className="py-1.5 font-medium">First → last cycle</th>
                  </tr>
                </thead>
                <tbody>
                  {L.lots.map((l, i) => (
                    <tr key={i} className="border-b border-[var(--border)]/60 last:border-0">
                      <td className="py-1.5 pr-3">{l.source === "spare" ? (isJa ? "スペア" : "Spare") : l.machine || "—"}</td>
                      <td className="py-1.5 pr-3 font-mono font-semibold">{l.lotNumber || "—"}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">{fmtNum(l.shots)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono font-semibold">{fmtNum(l.pieces)}</td>
                      <td className="py-1.5 font-mono">{fmtTime(l.firstCycleAt)} → {fmtTime(l.lastCycleAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {node.kind === "kensa" && onVoidLabel && (L.status === "complete" || L.status === "draft") && !L.kensaRecordId && (node.records || []).length === 0 && (
            <div className="mt-4">
              <VoidLabel node={node} isJa={isJa} onVoid={onVoidLabel} />
            </div>
          )}

          <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
            {(node.records || []).length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)]">
                {isJa ? "提出済みの記録はまだありません。" : "No submitted record yet."}
              </p>
            ) : (
              node.records.map((r) => (
                <div key={String(r._id)} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--text-secondary)]">
                    <span className="font-mono">{r.Date || "—"}</span>
                    {r.Time_start ? ` · ${r.Time_start}–${r.Time_end || ""}` : ""}
                    {" · "}
                    {r.Worker_Name || "—"}
                    {" · "}
                    <span className="font-mono font-semibold">{fmtNum(r.Total ?? r.Process_Quantity)}</span>
                    {Number(r.Total_NG) ? <span className="font-mono"> (NG {fmtNum(r.Total_NG)})</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenRecord(r, meta.record)}
                    className="h-7 rounded-[6px] bg-[var(--freya-blue)] px-3 text-[11px] font-semibold text-white"
                  >
                    {isJa ? "記録を開く" : "Open record"}
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// A row of cards. With several, the 2nd card peeks in by 1/8 of its width so the row visibly scrolls.
function TierRow({ nodes, rootId, isJa, onOpenRecord, onOpenWorkOrder, onVoidLabel }) {
  const many = nodes.length > 1;
  return (
    <div
      className={`flex gap-3 ${many ? "snap-x snap-mandatory overflow-x-auto pb-2" : ""}`}
      style={many ? { ["--card-w"]: "calc((100% - 0.75rem) / 1.125)" } : undefined}
    >
      {nodes.map((n) => (
        <div
          key={n.id}
          className={`flex ${many ? "snap-start" : "w-full"}`}
          style={many ? { width: "var(--card-w)", flex: "none" } : undefined}
        >
          <NodeCard node={n} isRoot={n.id === rootId} isJa={isJa} onOpenRecord={onOpenRecord} onOpenWorkOrder={onOpenWorkOrder} onVoidLabel={onVoidLabel} />
        </div>
      ))}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center py-1 text-[var(--freya-blue)]" aria-hidden>
      <svg width="22" height="28" viewBox="0 0 22 28" fill="currentColor">
        <path d="M11 0 21 12H15v16H7V12H1z" />
      </svg>
    </div>
  );
}

function RevealButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto flex h-8 items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
    >
      {children}
    </button>
  );
}

export default function ScnaTraceChain({ trace, isJa, onOpenRecord, onOpenWorkOrder, onVoidLabel }) {
  const [showEarlier, setShowEarlier] = useState(false);
  const [showLater, setShowLater] = useState(false);

  const { rows, earlierCount, laterCount } = useMemo(() => {
    const byId = new Map(trace.nodes.map((n) => [n.id, n]));
    const root = byId.get(trace.rootId);
    const before = reach(byId, trace.rootId, "parents");
    const after = reach(byId, trace.rootId, "children");
    const rootTier = TIER[root.kind];
    // rows[] top (latest process) to bottom (earliest), each { tier, role, nodes }
    const groups = new Map();
    const add = (id, role) => {
      const n = byId.get(id);
      const key = `${role}:${TIER[n.kind]}`;
      if (!groups.has(key)) groups.set(key, { tier: TIER[n.kind], role, nodes: [] });
      groups.get(key).nodes.push(n);
    };
    before.forEach((id) => add(id, "earlier"));
    after.forEach((id) => add(id, "later"));
    groups.set(`root:${rootTier}`, { tier: rootTier, role: "root", nodes: [root] });
    const list = [...groups.values()].sort((a, b) => b.tier - a.tier || (a.role === "later" ? -1 : 1));
    return { rows: list, earlierCount: before.size, laterCount: after.size };
  }, [trace]);

  const visible = rows.filter((r) => r.role === "root" || (r.role === "earlier" ? showEarlier : showLater));
  const firstRootIdx = visible.findIndex((r) => r.role === "root");

  return (
    <div>
      {laterCount > 0 && !showLater && (
        <>
          <RevealButton onClick={() => setShowLater(true)}>
            ▲ {isJa ? `後工程を表示 (${laterCount})` : `Show later processes (${laterCount})`}
          </RevealButton>
          <Arrow />
        </>
      )}
      {visible.map((row, i) => (
        <div key={`${row.role}:${row.tier}`}>
          {i > 0 && <Arrow />}
          <TierRow nodes={row.nodes} rootId={trace.rootId} isJa={isJa} onOpenRecord={onOpenRecord} onOpenWorkOrder={onOpenWorkOrder} onVoidLabel={onVoidLabel} />
        </div>
      ))}
      {earlierCount > 0 && !showEarlier && firstRootIdx >= 0 && (
        <>
          <Arrow />
          <RevealButton onClick={() => setShowEarlier(true)}>
            ▼ {isJa ? `前工程を表示 (${earlierCount})` : `Show earlier processes (${earlierCount})`}
          </RevealButton>
        </>
      )}
      {trace.truncated && (
        <p className="mt-3 text-center text-[11px] text-[var(--text-muted)]">
          {isJa ? "件数が多いため一部のみ表示しています。" : "Large chain: only part of it is shown."}
        </p>
      )}
    </div>
  );
}
