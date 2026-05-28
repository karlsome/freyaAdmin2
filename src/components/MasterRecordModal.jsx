import { useMemo, useState } from "react";
import ModalShell from "./ModalShell";

function buildInitialDraft(fieldDefinitions) {
  return fieldDefinitions.reduce((draft, field) => {
    draft[field.field] = "";
    return draft;
  }, {});
}

export default function MasterRecordModal({
  open,
  fieldDefinitions,
  submitting,
  onClose,
  onSubmit,
  tabLabel = "Master DB",
  recordLabel = "Master Record",
}) {
  const editableFields = useMemo(
    () => fieldDefinitions.filter((field) => field.field !== "imageURL"),
    [fieldDefinitions]
  );
  const [draft, setDraft] = useState(() => buildInitialDraft(editableFields));
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  if (!open) return null;

  const hasData = Object.values(draft).some((value) => String(value).trim());

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      eyebrow={`Create ${recordLabel}`}
      title={`Add New ${tabLabel} Record`}
      subtitle="Build a new entry with the full dynamic field set from the current schema."
      maxWidth="max-w-5xl"
    >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!hasData) return;
              onSubmit(draft, imageFile);
            }}
            className="max-h-[82vh] overflow-y-auto px-6 py-6 scrollbar-hide"
          >
            <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
              <div>
                <div className="rounded-2xl border border-separator/40 bg-surface-container-low p-4 sticky top-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Product Image</div>
                  <div className="mt-3 overflow-hidden rounded-2xl border border-separator/40 bg-surface min-h-[280px]">
                    {imagePreview ? (
                      <img src={imagePreview} alt="New record preview" className="h-[280px] w-full object-contain bg-surface-container-lowest" />
                    ) : (
                      <div className="flex h-[280px] items-center justify-center text-on-surface-variant">
                        <div className="text-center">
                          <span className="material-symbols-outlined" style={{ fontSize: 38 }}>image</span>
                          <p className="mt-3 text-sm font-medium">No image selected</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setImageFile(file);
                        if (!file) {
                          setImagePreview("");
                          return;
                        }

                        const reader = new FileReader();
                        reader.onload = () => setImagePreview(String(reader.result || ""));
                        reader.readAsDataURL(file);
                      }}
                    />
                    {imageFile ? "Replace Image" : "Upload Image"}
                  </label>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {editableFields.map((field) => {
                  const multiline = field.type === "textarea";

                  return (
                    <div key={field.field} className={multiline ? "md:col-span-2" : ""}>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-outline">
                        {field.label}
                      </label>

                      {multiline ? (
                        <textarea
                          rows={4}
                          value={draft[field.field] ?? ""}
                          onChange={(event) => setDraft((current) => ({ ...current, [field.field]: event.target.value }))}
                          className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                        />
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text"}
                          value={draft[field.field] ?? ""}
                          onChange={(event) => setDraft((current) => ({ ...current, [field.field]: event.target.value }))}
                          className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-outline-variant/20 pt-5">
              <p className="text-sm text-on-surface-variant">
                At least one field must be filled before the record can be inserted.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!hasData || submitting}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Create Record"}
                </button>
              </div>
            </div>
          </form>
    </ModalShell>
  );
}