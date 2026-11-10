import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useLanguage } from "../../contexts/LanguageContext";
import {
  fetchVideoManualProjectTrash,
  permanentlyDeleteVideoManualProject,
  restoreVideoManualProject,
} from "../../services/videoManualApi";

function formatDeletedAt(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "";
}

export default function VideoManualProjectTrashModal({ playlistId, canRestore, canPurge, onClose, onRestored }) {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await fetchVideoManualProjectTrash(playlistId));
    } catch (loadError) {
      setError(loadError.message || t("Failed to load the recycle bin."));
    } finally {
      setLoading(false);
    }
  }, [playlistId, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleKey = (event) => { if (event.key === "Escape" && !busyId) onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [busyId, onClose]);

  async function handleRestore(item) {
    setBusyId(String(item._id));
    setError("");
    try {
      await restoreVideoManualProject(item._id);
      setItems((current) => current.filter((entry) => String(entry._id) !== String(item._id)));
      onRestored?.(item);
    } catch (restoreError) {
      setError(restoreError.message || t("Failed to restore project."));
    } finally {
      setBusyId("");
    }
  }

  async function handlePurge(item) {
    if (!window.confirm(t("Permanently delete \"{title}\"? This cannot be undone.", { title: item?.title || "" }))) return;
    setBusyId(String(item._id));
    setError("");
    try {
      await permanentlyDeleteVideoManualProject(item._id);
      setItems((current) => current.filter((entry) => String(entry._id) !== String(item._id)));
    } catch (purgeError) {
      setError(purgeError.message || t("Failed to delete project."));
    } finally {
      setBusyId("");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { if (!busyId) onClose(); }}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="freya-card flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("vmTitle")}</p>
            <h2 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">{t("Recycle bin")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-6 py-5">
          <p className="text-xs text-[var(--text-muted)]">{t("Deleted projects stay here until they expire, then they are removed for good.")}</p>

          {error ? (
            <div className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3.5 py-3 text-xs font-semibold text-[var(--text-primary)]">{error}</div>
          ) : null}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-[8px] bg-[var(--surface)]" />)}
            </div>
          ) : items.length ? items.map((item) => {
            const busy = busyId === String(item._id);
            return (
              <div key={item._id} className="flex items-center gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 22 }}>movie</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.title || t("vmUntitledProject")}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                    {t("Deleted")} {formatDeletedAt(item.deletedAt)}{item.deletedBy ? ` · ${item.deletedBy}` : ""}
                    {" · "}{t("{n} days left", { n: item.daysRemaining ?? 0 })}
                  </p>
                </div>
                {canRestore ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRestore(item)}
                    className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--freya-blue-hover)] disabled:opacity-50"
                  >
                    {t("Restore")}
                  </button>
                ) : null}
                {canPurge ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handlePurge(item)}
                    className="rounded-[6px] border border-[var(--status-danger)]/40 px-3 py-1.5 text-xs font-semibold text-[var(--status-danger)] transition-colors hover:bg-[var(--status-danger)]/10 disabled:opacity-50"
                  >
                    {t("Delete forever")}
                  </button>
                ) : null}
              </div>
            );
          }) : (
            <div className="flex flex-col items-center gap-2 py-10 text-[var(--text-muted)]">
              <span className="material-symbols-outlined" style={{ fontSize: 32 }}>delete</span>
              <p className="text-sm font-semibold">{t("The recycle bin is empty.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
