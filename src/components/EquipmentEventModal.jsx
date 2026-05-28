import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchWorkerNames, uploadEquipmentEventImage } from "../services/api";
import FormField from "./FormField";
import ModalShell from "./ModalShell";

const CATEGORY_TAGS = ["メンテナンス", "修理", "部品交換", "テスト", "その他"];

function buildInitialDraft() {
  return {
    発生事案: "",
    詳細: "",
    名前: "",
    eventDate: "",
    tags: [],
    imageURLs: [],
  };
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export default function EquipmentEventModal({
  open,
  equipment = null,
  submitting,
  username = "unknown",
  onClose,
  onSubmit,
}) {
  const [draft, setDraft] = useState(buildInitialDraft);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [workerNames, setWorkerNames] = useState([]);
  const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
  const fileInputRef = useRef(null);
  const workerContainerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setDraft(buildInitialDraft());
    setUploadError("");
    setShowWorkerDropdown(false);
    fetchWorkerNames().then(setWorkerNames).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!showWorkerDropdown) return undefined;
    function handleClickOutside(e) {
      if (workerContainerRef.current && !workerContainerRef.current.contains(e.target)) {
        setShowWorkerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showWorkerDropdown]);

  const hasData = useMemo(
    () => draft.発生事案.trim() !== "" && draft.tags.length > 0,
    [draft]
  );

  function set(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleTag(tag) {
    setDraft((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((t) => t !== tag)
        : [...current.tags, tag],
    }));
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    setUploading(true);
    setUploadError("");

    try {
      const urls = await Promise.all(
        files.map(async (file) => {
          const base64 = await toBase64(file);
          const result = await uploadEquipmentEventImage({
            base64,
            factoryName: equipment?.["工場"] || "",
            equipmentName: equipment?.name || "",
            username,
          });
          return result.imageURL;
        })
      );
      setDraft((current) => ({
        ...current,
        imageURLs: [...current.imageURLs, ...urls],
      }));
    } catch (err) {
      const raw = err?.message || "";
      setUploadError(raw.startsWith("<") ? "Upload failed — server error. Check that the server is running." : raw || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url) {
    setDraft((current) => ({
      ...current,
      imageURLs: current.imageURLs.filter((u) => u !== url),
    }));
  }

  if (!open) return null;

  function handleSubmit(event) {
    event.preventDefault();
    if (!hasData) return;
    const trimmedName = draft["名前"].trim();
    const isNewWorker =
      trimmedName !== "" &&
      !workerNames.some((n) => n.toLowerCase() === trimmedName.toLowerCase());
    onSubmit({
      ...draft,
      名前: trimmedName,
      equipmentId: equipment?._id?.$oid ?? equipment?._id ?? "",
      equipmentName: equipment?.name || "",
      工場: equipment?.["工場"] || "",
      _newWorkerName: isNewWorker ? trimmedName : undefined,
    });
  }

  return createPortal(
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="事案登録"
      title="事案を追加"
      subtitle="設備に関する故障・修理・アップグレードなどを記録します。"
      maxWidth="max-w-lg"
      align="start"
    >
          <form onSubmit={handleSubmit} className="max-h-[82vh] overflow-y-auto px-6 py-6 scrollbar-hide">
            <div className="grid gap-4">

              {/* Equipment (read-only) */}
              <div className="rounded-2xl border border-separator/40 bg-surface-container px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">設備</p>
                <p className="mt-0.5 text-sm font-bold text-on-surface">{equipment?.name || "—"}</p>
                {equipment?.["工場"] && (
                  <p className="text-[11px] text-on-surface-variant">{equipment["工場"]}</p>
                )}
              </div>

              {/* Incident title */}
              <FormField label="発生事案" variant="form" required>
                <input type="text" value={draft["発生事案"]}
                  onChange={(e) => set("発生事案", e.target.value)}
                  placeholder="例：ベルト交換、モーター修理、定期点検…"
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                  required />
              </FormField>

              {/* Details */}
              <FormField label="詳細" variant="form">
                <textarea value={draft["詳細"]}
                  onChange={(e) => set("詳細", e.target.value)}
                  placeholder="詳細な内容を入力してください…"
                  rows={4}
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40 resize-none" />
              </FormField>

              {/* Name + date */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="名前" variant="form">
                  <div ref={workerContainerRef} className="relative">
                    <input
                      type="text"
                      value={draft["名前"]}
                      onChange={(e) => { set("名前", e.target.value); setShowWorkerDropdown(true); }}
                      onFocus={() => setShowWorkerDropdown(true)}
                      placeholder="担当者名"
                      autoComplete="off"
                      className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                    />
                    {showWorkerDropdown && (() => {
                      const q = draft["名前"].toLowerCase();
                      const filtered = q
                        ? workerNames.filter((n) => n.toLowerCase().includes(q))
                        : workerNames;
                      return filtered.length > 0 ? (
                        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-2xl border border-separator/40 bg-surface shadow-lg">
                          {filtered.map((name) => (
                            <li key={name}>
                              <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); set("名前", name); setShowWorkerDropdown(false); }}
                                className="w-full px-4 py-2 text-left text-sm text-on-surface transition hover:bg-surface-container"
                              >
                                {name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null;
                    })()}
                  </div>
                </FormField>
                <FormField label="発生日" variant="form">
                  <input type="date" value={draft.eventDate}
                    onChange={(e) => set("eventDate", e.target.value)}
                    className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40" />
                </FormField>
              </div>

              {/* Image / video upload */}
              <FormField label="画像 / 動画" variant="form">

                <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/quicktime" multiple
                  className="hidden" onChange={handleFileChange} />

                <button type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/30 bg-surface px-4 py-2.5 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50">
                  {uploading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }}>progress_activity</span>
                      アップロード中…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>attach_file</span>
                      ファイルを添付
                    </>
                  )}
                </button>

                {uploadError && (
                  <p className="mt-2 text-xs text-error">{uploadError}</p>
                )}

                {draft.imageURLs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {draft.imageURLs.map((url) => {
                      const isVideo = /\.(mp4|mov)$/i.test(url.split("?")[0]);
                      return (
                        <div key={url} className="group relative">
                          {isVideo ? (
                            <video src={url}
                              className="h-16 w-16 rounded-xl object-cover border border-separator/40 bg-black"
                              muted playsInline />
                          ) : (
                            <img src={url} alt="添付画像"
                              className="h-16 w-16 rounded-xl object-cover border border-separator/40" />
                          )}
                          <button type="button"
                            onClick={() => removeImage(url)}
                            className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-error text-white group-hover:flex"
                            style={{ fontSize: 11 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </FormField>

              {/* Category tags */}
              <FormField label="カテゴリ" variant="form" required>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_TAGS.map((tag) => {
                    const selected = draft.tags.includes(tag);
                    return (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                          selected
                            ? "bg-primary text-on-primary shadow-sm"
                            : "border border-outline-variant/30 bg-surface text-on-surface hover:bg-surface-container"
                        }`}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </FormField>

            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-outline-variant/20 pt-5">
              <p className="text-sm text-on-surface-variant">発生事案・カテゴリは必須です。</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose}
                  className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container">
                  Cancel
                </button>
                <button type="submit" disabled={!hasData || submitting || uploading}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50">
                  {submitting ? "保存中…" : "事案を登録"}
                </button>
              </div>
            </div>
          </form>

    </ModalShell>,
    document.body
  );
}
