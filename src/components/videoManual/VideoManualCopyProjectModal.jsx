import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useLanguage } from "../../contexts/LanguageContext";
import { duplicateVideoManualProject } from "../../services/videoManualApi";

/** Pick a playlist and copy the project into it. */
export default function VideoManualCopyProjectModal({ project, playlists, currentPlaylistId, onClose, onCopied }) {
  const { t } = useLanguage();
  const [targetId, setTargetId] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKey = (event) => { if (event.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, saving]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return playlists.filter((playlist) => String(playlist._id) !== String(currentPlaylistId) && (!needle || String(playlist.name || "").toLowerCase().includes(needle)));
  }, [currentPlaylistId, playlists, query]);

  async function handleCopy() {
    if (!targetId) return;
    setSaving(true);
    setError("");
    try {
      const copy = await duplicateVideoManualProject(project._id, { targetPlaylistId: targetId });
      onCopied(copy, playlists.find((playlist) => String(playlist._id) === String(targetId)));
    } catch (copyError) {
      setError(copyError.message || t("Failed to copy project."));
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { if (!saving) onClose(); }}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="freya-card flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{project?.title}</p>
            <h2 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">{t("Copy to playlist")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search playlists")}
            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
          />

          <div className="space-y-1.5">
            {visible.length ? visible.map((playlist) => {
              const active = String(playlist._id) === targetId;
              return (
                <button
                  key={playlist._id}
                  type="button"
                  onClick={() => setTargetId(String(playlist._id))}
                  className={`flex w-full items-center gap-3 rounded-[8px] border px-4 py-2.5 text-left transition-colors ${active ? "border-[var(--freya-blue)] bg-[var(--freya-blue)]/10" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"}`}
                >
                  <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 18 }}>{active ? "radio_button_checked" : "playlist_play"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">{playlist.name}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{playlist.projectCount ?? 0}</span>
                </button>
              );
            }) : (
              <p className="py-6 text-center text-xs font-semibold text-[var(--text-muted)]">{t("No other playlists available.")}</p>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            {t("Copies the working project and the media it uses. Revision history and the deployed video are not copied.")}
          </p>

          {error ? (
            <div className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3.5 py-3 text-xs font-semibold text-[var(--text-primary)]">{error}</div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border)] px-6 py-3.5">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50">
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!targetId || saving}
            className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t("Copying...") : t("Copy")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
