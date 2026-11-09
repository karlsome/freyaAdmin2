import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../contexts/LanguageContext";
import {
  fetchEquipmentHistoryBin,
  permanentDeleteEquipmentHistory,
  restoreEquipmentHistoryRecord,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";
import SetsubiArchiveWorkspace from "./SetsubiArchiveWorkspace";

function ConfirmModal({ message, onConfirm, onCancel, isJa }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] p-6 shadow-2xl">
        <p className="text-sm font-medium text-[var(--text-primary)]">{message}</p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[6px] bg-[var(--status-danger)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 shadow-xs"
          >
            {isJa ? "確定" : "Confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function EquipmentHistoryBinWorkspace({ refreshToken, onFlash }) {
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
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchEquipmentHistoryBin()
      .then((rows) => { if (active) setRecords(Array.isArray(rows) ? rows : []); })
      .catch((err) => { if (active) setError(err?.message || (isJa ? "リサイクルビンの読み込みに失敗しました。" : "Failed to load recycle bin.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshToken, localRefresh, isJa]);

  const filtered = records.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r["発生事案"], r["工場"], r.equipmentName, r._deletedBy, r._deleteReason]
      .some((v) => String(v || "").toLowerCase().includes(q));
  });

  async function handleRestore(record) {
    const recordId = record._id?.$oid ?? record._id;
    setBusy(recordId);
    try {
      await restoreEquipmentHistoryRecord({ recordId, username, role: authUser?.role });
      onFlash?.({ type: "success", message: isJa ? "レコードを復元しました。" : "Record restored." });
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || (isJa ? "レコードの復元に失敗しました。" : "Failed to restore record.") });
    } finally {
      setBusy(null);
    }
  }

  function promptPermanentDelete(record) {
    const recordId = record._id?.$oid ?? record._id;
    setConfirm({
      message: isJa
        ? `「${record["発生事案"] || recordId}」を完全に削除しますか？この操作は取り消せません。`
        : `Permanently delete "${record["発生事案"] || recordId}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null);
        setBusy(recordId);
        try {
          await permanentDeleteEquipmentHistory({ recordId, username, role: authUser?.role });
          onFlash?.({ type: "success", message: isJa ? "レコードを完全に削除しました。" : "Record permanently deleted." });
          setLocalRefresh((n) => n + 1);
        } catch (err) {
          onFlash?.({ type: "error", message: err?.message || (isJa ? "レコードの削除に失敗しました。" : "Failed to delete record.") });
        } finally {
          setBusy(null);
        }
      },
    });
  }

  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {isJa ? "設備" : "Equipment"}
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
            {isJa ? "保全記録リサイクルビン" : "Maintenance Record Recycle Bin"}
          </h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {isJa
              ? "論理削除された事案レコードです。復元または完全に削除できます。"
              : "Soft-deleted 事案 records. Restore or permanently delete."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-xs text-[var(--text-muted)]">
              {isJa ? `ゴミ箱内: ${records.length} 件` : `${records.length} records in bin`}
            </span>
          )}
          <button
            type="button"
            onClick={() => setArchiveOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-500/20"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>inventory_2</span>
            {isJa ? "アーカイブを表示" : "View Archive"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isJa ? "発生事案、工場、設備、削除者、理由で検索…" : "Search by 発生事案, 工場, equipment, deleted by, reason…"}
          className="w-full max-w-lg rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] placeholder:text-[var(--text-muted)]"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-12 text-sm text-[var(--text-muted)]">
          <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
          {isJa ? "読み込み中…" : "Loading…"}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-[8px] bg-error/10 border border-error/20 px-4 py-3 text-sm font-medium text-error">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-10 text-center text-sm text-[var(--text-muted)]">
          {records.length === 0
            ? (isJa ? "リサイクルビンは空です。" : "Recycle bin is empty.")
            : (isJa ? "検索に一致するレコードがありません。" : "No records matched the search.")}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                {[
                  isJa ? "発生事案" : "Incident",
                  isJa ? "工場 / 設備" : "Factory / Equipment",
                  isJa ? "削除日時" : "Deleted At",
                  isJa ? "削除者" : "Deleted By",
                  isJa ? "理由" : "Reason",
                  "",
                ].map((h, idx) => (
                  <th key={idx} className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((record, i) => {
                const recordId = record._id?.$oid ?? record._id ?? String(i);
                const isBusy = busy === recordId;
                const deletedAt = record._deletedAt
                  ? new Date(record._deletedAt).toLocaleString(isJa ? "ja-JP" : "en-US")
                  : "—";
                const tags = Array.isArray(record.tags) ? record.tags : [];

                return (
                  <tr key={recordId} className="border-b border-[var(--border)] bg-[var(--surface)] transition hover:bg-[var(--surface-hover)]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--text-primary)]">{record["発生事案"] || "—"}</p>
                      {tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <span key={tag} className="rounded-[4px] bg-[var(--surface-subtle)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      <div className="text-[var(--text-primary)]">{record["工場"] || "—"}</div>
                      <div className="text-[11px]">{record.equipmentName || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{deletedAt}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{record._deletedBy || "—"}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{record._deleteReason || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleRestore(record)}
                          disabled={isBusy}
                          className="rounded-[6px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--freya-blue)] transition hover:bg-[var(--freya-blue)]/20 disabled:opacity-50"
                        >
                          {isBusy ? "…" : (isJa ? "復元" : "Restore")}
                        </button>
                        {canAdmin && (
                          <button
                            type="button"
                            onClick={() => promptPermanentDelete(record)}
                            disabled={isBusy}
                            className="rounded-[6px] border border-error/20 bg-error/10 px-2.5 py-1 text-xs font-semibold text-error transition hover:bg-error/20 disabled:opacity-50"
                          >
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

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          isJa={isJa}
        />
      )}

      {archiveOpen && (
        <SetsubiArchiveWorkspace
          onFlash={onFlash}
          onClose={() => setArchiveOpen(false)}
        />
      )}
    </div>
  );
}
