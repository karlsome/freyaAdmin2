import { useEffect, useState } from "react";
import { fetchEquipmentHistory } from "../services/api";

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">{label}</dt>
      <dd className="text-sm text-on-surface">{value}</dd>
    </div>
  );
}

function EventCard({ event }) {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        {event.eventDate ? (
          <span className="rounded-xl bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            {event.eventDate}
          </span>
        ) : (
          <span className="text-[11px] text-on-surface-variant/50">日付未記入</span>
        )}
        {event["名前"] && (
          <span className="text-[11px] text-on-surface-variant">{event["名前"]}</span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-on-surface">
        {event["発生事案"] || "—"}
      </p>
    </div>
  );
}

/**
 * Reusable modal for viewing a piece of equipment's details and its full event history.
 *
 * Props:
 *   open       — boolean
 *   equipment  — setsubiDB record object
 *   onClose    — () => void
 */
export default function EquipmentViewModal({ open, equipment, onClose }) {
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    if (!open || !equipment) return undefined;

    const equipmentId = equipment._id?.$oid ?? equipment._id;
    if (!equipmentId) return undefined;

    let active = true;
    setHistory([]);
    setHistoryError("");
    setHistoryLoading(true);

    fetchEquipmentHistory(String(equipmentId))
      .then((records) => {
        if (!active) return;
        setHistory(Array.isArray(records) ? records : []);
      })
      .catch((err) => {
        if (!active) return;
        setHistoryError(err?.message || "Failed to load event history.");
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => { active = false; };
  }, [open, equipment]);

  if (!open || !equipment) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="glass-card w-full max-w-xl rounded-2xl overflow-hidden">

          <div className="border-b border-outline-variant/20 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">設備詳細</div>
                <h3 className="mt-2 text-2xl font-black text-on-surface">
                  {equipment.name || "—"}
                </h3>
                {equipment["工場"] && (
                  <p className="mt-1 text-sm text-on-surface-variant">{equipment["工場"]}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <div className="max-h-[80vh] overflow-y-auto px-6 py-6 scrollbar-hide">

            <section className="mb-6">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">設備情報</p>
              <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container px-5 py-4">
                <DetailRow label="設備名" value={equipment.name} />
                <DetailRow label="工場" value={equipment["工場"]} />
                <DetailRow label="設置日" value={equipment.installationDate} />
              </dl>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">事案履歴</p>
                {!historyLoading && (
                  <span className="text-[11px] text-on-surface-variant">
                    {history.length} {history.length === 1 ? "件" : "件"}
                  </span>
                )}
              </div>

              {historyLoading && (
                <div className="flex items-center gap-2 py-4 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                  読み込み中…
                </div>
              )}

              {!historyLoading && historyError && (
                <div className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">{historyError}</div>
              )}

              {!historyLoading && !historyError && history.length === 0 && (
                <div className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-6 text-center text-sm text-on-surface-variant italic">
                  事案の記録はまだありません。
                </div>
              )}

              {!historyLoading && !historyError && history.length > 0 && (
                <div className="flex flex-col gap-3">
                  {history.map((event, index) => {
                    const id = event._id?.$oid ?? event._id ?? String(index);
                    return <EventCard key={id} event={event} />;
                  })}
                </div>
              )}
            </section>

          </div>

          <div className="border-t border-outline-variant/20 px-6 py-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-surface-container px-5 py-2.5 text-xs font-bold text-on-surface transition hover:bg-surface-container-high"
            >
              閉じる
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
