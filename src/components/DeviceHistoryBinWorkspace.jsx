import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchDeviceHistoryBin, permanentDeleteDeviceHistory, restoreDeviceHistoryRecord } from "../services/api";
import { getAuthUser } from "../utils/masterDB";
import DeviceArchiveWorkspace from "./DeviceArchiveWorkspace";

function ConfirmModal({ message, onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center px-4 pb-4 pt-10">
        <div className="glass-card w-full max-w-sm rounded-2xl overflow-hidden">
          <div className="px-6 py-6">
            <p className="text-sm text-on-surface">{message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onCancel}
                className="rounded-2xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container">
                Cancel
              </button>
              <button type="button" onClick={onConfirm}
                className="rounded-2xl bg-error px-4 py-2 text-xs font-bold text-white transition hover:opacity-90">
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function DeviceHistoryBinWorkspace({ refreshToken, onFlash }) {
  const authUser = getAuthUser();
  const username = authUser?.username || "unknown";
  const canAdmin = authUser?.role === "admin";

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [localRefresh, setLocalRefresh] = useState(0);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchDeviceHistoryBin()
      .then((rows) => { if (active) setRecords(Array.isArray(rows) ? rows : []); })
      .catch((err) => { if (active) setError(err?.message || "Failed to load recycle bin."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshToken, localRefresh]);

  const filtered = records.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r["発生事案"], r["工場"], r.deviceName, r._deletedBy, r._deleteReason]
      .some((v) => String(v || "").toLowerCase().includes(q));
  });

  async function handleRestore(record) {
    const recordId = record._id?.$oid ?? record._id;
    setBusy(recordId);
    try {
      await restoreDeviceHistoryRecord({ recordId, username, role: authUser?.role });
      onFlash?.({ type: "success", message: "Record restored." });
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || "Failed to restore record." });
    } finally {
      setBusy(null);
    }
  }

  function promptPermanentDelete(record) {
    const recordId = record._id?.$oid ?? record._id;
    setConfirm({
      message: `Permanently delete "${record["発生事案"] || recordId}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null);
        setBusy(recordId);
        try {
          await permanentDeleteDeviceHistory({ recordId, username, role: authUser?.role });
          onFlash?.({ type: "success", message: "Record permanently deleted." });
          setLocalRefresh((n) => n + 1);
        } catch (err) {
          onFlash?.({ type: "error", message: err?.message || "Failed to delete record." });
        } finally {
          setBusy(null);
        }
      },
    });
  }

  return (
    <section className="glass-card rounded-2xl p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">デバイス</p>
          <h3 className="mt-1 text-2xl font-black text-on-surface">Device History Recycle Bin</h3>
          <p className="mt-1 text-sm text-on-surface-variant">Soft-deleted 事案 records. Restore or permanently delete.</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-sm text-on-surface-variant">{records.length} records in bin</span>
          )}
          <button type="button" onClick={() => setArchiveOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-600 transition hover:bg-amber-500/20">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>inventory_2</span>
            View Archive
          </button>
        </div>
      </div>

      <div className="mb-5">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by 発生事案, 工場, device, deleted by, reason…"
          className="w-full max-w-lg rounded-2xl border border-outline-variant/30 bg-surface px-4 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary/40" />
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-12 text-sm text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
          読み込み中…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl bg-error/10 px-5 py-4 text-sm font-medium text-error">{error}</div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl border border-outline-variant/20 bg-surface px-5 py-10 text-center text-sm text-on-surface-variant">
          {records.length === 0 ? "リサイクルビンは空です。" : "No records matched the search."}
        </div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-outline-variant/20">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-container">
                {["発生事案", "工場 / デバイス", "削除日時", "削除者", "理由", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-outline">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((record, i) => {
                const recordId = record._id?.$oid ?? record._id ?? String(i);
                const isBusy = busy === recordId;
                const deletedAt = record._deletedAt ? new Date(record._deletedAt).toLocaleString("ja-JP") : "—";
                const tags = Array.isArray(record.tags) ? record.tags : [];
                return (
                  <tr key={recordId} className="border-b border-outline-variant/10 bg-surface transition hover:bg-surface-container/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-on-surface">{record["発生事案"] || "—"}</p>
                      {tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">{tag}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {record["工場"] && <span>{record["工場"]}</span>}
                      {record.deviceName && <span className="block text-[11px] opacity-70">{record.deviceName}</span>}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{deletedAt}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{record._deletedBy || "—"}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">{record._deleteReason || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => handleRestore(record)} disabled={isBusy}
                          className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary transition hover:bg-primary/20 disabled:opacity-50">
                          {isBusy ? "…" : "Restore"}
                        </button>
                        {canAdmin && (
                          <button type="button" onClick={() => promptPermanentDelete(record)} disabled={isBusy}
                            className="rounded-xl border border-error/20 bg-error/10 px-3 py-1.5 text-[11px] font-bold text-error transition hover:bg-error/20 disabled:opacity-50">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirm && (
        <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}

      {archiveOpen && (
        <DeviceArchiveWorkspace
          onFlash={onFlash}
          onClose={() => setArchiveOpen(false)}
        />
      )}
    </section>
  );
}
