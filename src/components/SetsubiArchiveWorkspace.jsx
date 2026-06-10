import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import IconButton from "./IconButton";
import {
  fetchSetsubiArchive,
  permanentDeleteEquipmentRecord,
  restoreEquipmentRecord,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";

function ConfirmModal({ message, onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/50 backdrop-blur-md">
      <div className="flex min-h-full items-start justify-center px-4 pb-4 pt-10">
        <div className="dashboard-section w-full max-w-sm rounded-2xl overflow-hidden">
          <div className="px-6 py-6">
            <p className="text-sm text-on-surface">{message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onCancel}
                className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container">
                Cancel
              </button>
              <button type="button" onClick={onConfirm}
                className="rounded-2xl bg-error px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90">
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

export default function SetsubiArchiveWorkspace({ onFlash, onClose }) {
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchSetsubiArchive()
      .then((rows) => { if (active) setRecords(Array.isArray(rows) ? rows : []); })
      .catch((err) => { if (active) setError(err?.message || "Failed to load archive."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [localRefresh]);

  const filtered = records.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.name, r["工場"], r._archivedBy]
      .some((v) => String(v || "").toLowerCase().includes(q));
  });

  async function handleRestore(record) {
    const recordId = record._id?.$oid ?? record._id;
    setBusy(recordId);
    try {
      await restoreEquipmentRecord({ recordId, username, role: authUser?.role });
      onFlash?.({ type: "success", message: "Equipment restored." });
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || "Failed to restore equipment." });
    } finally {
      setBusy(null);
    }
  }

  function promptPermanentDelete(record) {
    const recordId = record._id?.$oid ?? record._id;
    setConfirm({
      message: `Permanently delete "${record.name || recordId}"? This cannot be undone and all associated maintenance history will become orphaned.`,
      onConfirm: async () => {
        setConfirm(null);
        setBusy(recordId);
        try {
          await permanentDeleteEquipmentRecord({ recordId, username, role: authUser?.role });
          onFlash?.({ type: "success", message: "Equipment permanently deleted." });
          setLocalRefresh((n) => n + 1);
        } catch (err) {
          onFlash?.({ type: "error", message: err?.message || "Failed to delete equipment." });
        } finally {
          setBusy(null);
        }
      },
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-black/50 backdrop-blur-md">
      <div className="flex min-h-full items-start justify-center px-4 pb-4 pt-10">
        <div className="w-full max-w-4xl">
          <div className="mb-3 flex justify-end">
            <IconButton icon="close" onClick={onClose} variant="light" ariaLabel="Close dialog" className="bg-white/20 hover:bg-white/30" />
          </div>

          <section className="dashboard-section rounded-2xl p-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">設備</p>
                <h3 className="mt-1 text-2xl font-semibold text-on-surface">Equipment Archive</h3>
                <p className="mt-1 text-sm text-on-surface-variant">Archived equipment records. Restore or permanently delete (admin only).</p>
              </div>
              {!loading && (
                <span className="text-sm text-on-surface-variant">{records.length} records in archive</span>
              )}
            </div>

            <div className="mb-5">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, factory, archived by…"
                className="w-full max-w-lg rounded-2xl border border-outline-variant/30 bg-surface px-4 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary/40"
              />
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
              <div className="rounded-2xl border border-separator/40 bg-surface px-5 py-10 text-center text-sm text-on-surface-variant">
                {records.length === 0 ? "アーカイブは空です。" : "No records matched the search."}
              </div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-separator/40">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/20 bg-surface-container">
                      {["設備名", "工場", "アーカイブ日時", "アーカイブ者", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((record, i) => {
                      const recordId = record._id?.$oid ?? record._id ?? String(i);
                      const isBusy = busy === recordId;
                      const archivedAt = record._archivedAt
                        ? new Date(record._archivedAt).toLocaleString("ja-JP")
                        : "—";

                      return (
                        <tr key={recordId} className="border-b border-outline-variant/10 bg-surface transition hover:bg-surface-container/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {record.imageURL && (
                                <img src={record.imageURL} alt="" className="h-8 w-8 rounded-lg object-cover border border-separator/40 flex-shrink-0" />
                              )}
                              <p className="font-semibold text-on-surface">{record.name || "—"}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">{record["工場"] || "—"}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{archivedAt}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{record._archivedBy || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" onClick={() => handleRestore(record)} disabled={isBusy}
                                className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50">
                                {isBusy ? "…" : "Restore"}
                              </button>
                              {canAdmin && (
                                <button type="button" onClick={() => promptPermanentDelete(record)} disabled={isBusy}
                                  className="rounded-xl border border-error/20 bg-error/10 px-3 py-1.5 text-[11px] font-semibold text-error transition hover:bg-error/20 disabled:opacity-50">
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
          </section>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>,
    document.body
  );
}
