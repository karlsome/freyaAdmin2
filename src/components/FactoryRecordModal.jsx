import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import FormField from "./FormField";
import ModalShell from "./ModalShell";

function buildInitialDraft(record) {
  if (!record) {
    return {
      工場: "",
      location: "",
      geotag: "",
      latitude: "",
      longitude: "",
      phone: "",
    };
  }

  return {
    工場: record["工場"] || "",
    location: record.location || "",
    geotag: record.geotag || "",
    latitude: record.coordinates?.lat ?? "",
    longitude: record.coordinates?.lon ?? "",
    phone: record.phone || "",
  };
}

export default function FactoryRecordModal({
  open,
  record,
  submitting,
  onClose,
  onSubmit,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [draft, setDraft] = useState(() => buildInitialDraft(record));

  useEffect(() => {
    if (!open) return undefined;
    setDraft(buildInitialDraft(record));
  }, [open, record]);

  const hasData = useMemo(
    () => Object.values(draft).some((value) => String(value).trim() !== ""),
    [draft]
  );

  if (!open) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={record ? (isJa ? "工場を編集" : "Edit Factory") : (isJa ? "工場を作成" : "Create Factory")}
      title={record ? (isJa ? "工場レコードの編集" : "Edit Factory Record") : (isJa ? "工場レコードの追加" : "Add Factory Record")}
      subtitle={record
        ? (isJa ? "選択した工場の詳細情報を更新します。" : "Update the selected factory details.")
        : (isJa ? "新規工場エントリを作成します。" : "Create a new factory entry.")}
      maxWidth="max-w-3xl"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!hasData) return;
          onSubmit(draft);
        }}
        className="max-h-[82vh] overflow-y-auto px-6 py-6 scrollbar-hide"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={isJa ? "工場名" : "Factory"} variant="form">
            <input
              type="text"
              value={draft["工場"]}
              onChange={(event) => setDraft((current) => ({ ...current, 工場: event.target.value }))}
              placeholder={isJa ? "例: 本社工場" : "e.g. Main Plant"}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
          </FormField>

          <FormField label={isJa ? "所在地" : "Location"} variant="form">
            <input
              type="text"
              value={draft.location}
              onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
              placeholder={isJa ? "住所" : "Address"}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
          </FormField>

          <FormField label={isJa ? "ジオタグ" : "Geo Tag"} variant="form">
            <input
              type="text"
              value={draft.geotag}
              onChange={(event) => setDraft((current) => ({ ...current, geotag: event.target.value }))}
              placeholder={isJa ? "ジオタグ" : "Geo tag identifier"}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
          </FormField>

          <FormField label={isJa ? "電話番号" : "Phone"} variant="form">
            <input
              type="text"
              value={draft.phone}
              onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
              placeholder={isJa ? "例: 052-123-4567" : "e.g. 052-123-4567"}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
          </FormField>

          <FormField label={isJa ? "緯度 (Latitude)" : "Latitude"} variant="form">
            <input
              type="text"
              value={draft.latitude}
              onChange={(event) => setDraft((current) => ({ ...current, latitude: event.target.value }))}
              placeholder="35.xxxxxx"
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
          </FormField>

          <FormField label={isJa ? "経度 (Longitude)" : "Longitude"} variant="form">
            <input
              type="text"
              value={draft.longitude}
              onChange={(event) => setDraft((current) => ({ ...current, longitude: event.target.value }))}
              placeholder="136.xxxxxx"
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
          </FormField>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--text-muted)]">
            {isJa ? "保存する前に少なくとも1つのフィールドを入力してください。" : "At least one field must be filled before saving."}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
            >
              {isJa ? "キャンセル" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={!hasData || submitting}
              className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? (isJa ? "保存中…" : "Saving…")
                : record
                ? (isJa ? "変更を保存" : "Save Changes")
                : (isJa ? "工場を作成" : "Create Factory")}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
