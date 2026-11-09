import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../contexts/LanguageContext";
import IconButton from "./IconButton";
import {
  fetchSetsubiArchive,
  permanentDeleteEquipmentRecord,
  restoreEquipmentRecord,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";

function ConfirmModal({ message, onConfirm, onCancel }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5">
          <p className="text-xs text-[var(--text-primary)] leading-relaxed">{message}</p>
          <div className="mt-5 flex justify-end gap-2.5">
            <button type="button" onClick={onCancel}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] shadow-2xs">
              {isJa ? "キャンセル" : "Cancel"}
            </button>
            <button type="button" onClick={onConfirm}
              className="rounded-[6px] bg-[var(--status-danger)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--status-danger)]/90 shadow-xs">
              {isJa ? "削除する" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function SetsubiArchiveWorkspace({ onFlash, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

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
      .catch((err) => { if (active) setError(err?.message || (isJa ? "アーカイブの読み込みに失敗しました。" : "Failed to load archive.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [localRefresh, isJa]);

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
      onFlash?.({ type: "success", message: isJa ? "設備を復元しました。" : "Equipment restored." });
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || (isJa ? "設備の復元に失敗しました。" : "Failed to restore equipment.") });
    } finally {
      setBusy(null);
    }
  }

  function promptPermanentDelete(record) {
    const recordId = record._id?.$oid ?? record._id;
    setConfirm({
      message: isJa
        ? `「${record.name || recordId}」を完全に削除しますか？ この操作は取り消せず、関連する保全履歴も孤立します。`
        : `Permanently delete "${record.name || recordId}"? This cannot be undone and all associated maintenance history will become orphaned.`,
      onConfirm: async () => {
        setConfirm(null);
        setBusy(recordId);
        try {
          await permanentDeleteEquipmentRecord({ recordId, username, role: authUser?.role });
          onFlash?.({ type: "success", message: isJa ? "設備を完全に削除しました。" : "Equipment permanently deleted." });
          setLocalRefresh((n) => n + 1);
        } catch (err) {
          onFlash?.({ type: "error", message: err?.message || (isJa ? "設備の削除に失敗しました。" : "Failed to delete equipment.") });
        } finally {
          setBusy(null);
        }
      },
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl my-8">
        <div className="mb-3 flex justify-end">
          <IconButton icon="close" onClick={onClose} variant="light" ariaLabel={isJa ? "閉じる" : "Close dialog"} className="bg-white/20 hover:bg-white/30" />
        </div>

        <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{isJa ? "設備" : "Equipment"}</p>
              <h3 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">{isJa ? "設備アーカイブ" : "Equipment Archive"}</h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {isJa ? "アーカイブされた設備レコードです。復元または完全削除（管理者のみ）が可能です。" : "Archived equipment records. Restore or permanently delete (admin only)."}
              </p>
            </div>
            {!loading && (
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {records.length} {isJa ? "件のアーカイブ" : "records in archive"}
              </span>
            )}
          </div>

          <div className="mb-5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isJa ? "設備名、工場、アーカイブ者で検索…" : "Search by name, factory, archived by…"}
              className="w-full max-w-lg rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-12 text-xs font-medium text-[var(--text-muted)]">
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
              {isJa ? "読み込み中…" : "Loading…"}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-5 py-4 text-xs font-medium text-[var(--status-danger)]">{error}</div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-10 text-center text-xs text-[var(--text-muted)]">
              {records.length === 0
                ? (isJa ? "アーカイブは空です。" : "Archive is empty.")
                : (isJa ? "検索に一致するレコードがありません。" : "No records matched the search.")}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="overflow-hidden rounded-[8px] border border-[var(--border)]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                    {[isJa ? "設備名" : "Equipment", isJa ? "工場" : "Factory", isJa ? "アーカイブ日時" : "Archived At", isJa ? "アーカイブ者" : "Archived By", ""].map((h, idx) => (
                      <th key={idx} className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-[0.04em] uppercase text-[var(--text-muted)]">
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
                      ? new Date(record._archivedAt).toLocaleString(isJa ? "ja-JP" : "en-US")
                      : "—";

                    return (
                      <tr key={recordId} className="border-b border-[var(--border)] bg-[var(--surface)] transition hover:bg-[var(--surface-hover)]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {record.imageURL && (
                              <img src={record.imageURL} alt="" className="h-8 w-8 rounded-[6px] object-cover border border-[var(--border)] flex-shrink-0" />
                            )}
                            <p className="font-semibold text-[var(--text-primary)]">{record.name || "—"}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{record["工場"] || "—"}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{archivedAt}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{record._archivedBy || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => handleRestore(record)} disabled={isBusy}
                              className="rounded-[6px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--freya-blue)] transition hover:bg-[var(--freya-blue)]/20 shadow-2xs disabled:opacity-50">
                              {isBusy ? "…" : (isJa ? "復元" : "Restore")}
                            </button>
                            {canAdmin && (
                              <button type="button" onClick={() => promptPermanentDelete(record)} disabled={isBusy}
                                className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger)]/20 shadow-2xs disabled:opacity-50">
                                {isJa ? "削除" : "Delete"}
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
