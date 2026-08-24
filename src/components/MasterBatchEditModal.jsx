import { useMemo, useState } from "react";
import { formatMasterValue, getMasterPreviewFields, getMasterRecordIdentity, getMasterTabUI } from "../utils/masterDB";
import IconButton from "./IconButton";
import ModalShell from "./ModalShell";
import { SearchableSelect, SearchableHinbanSelect } from "./AdvancedFilterSection";

function PreviewCard({ record, changes, previewFields, tabKey }) {
  const identity = getMasterRecordIdentity(record, tabKey);
  const changedFields = Object.entries(changes);

  return (
    <div className="rounded-2xl border border-separator/40 bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold text-on-surface">{identity.title}</h4>
          <p className="mt-1 text-xs text-on-surface-variant">{identity.subtitle || "No secondary identifier"}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          Preview
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {changedFields.length ? changedFields.map(([field, nextValue]) => (
          <div key={field} className="rounded-2xl bg-surface-container-low p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{field}</div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-error">Old</div>
                <div className="mt-1 text-sm text-on-surface">{formatMasterValue(record[field])}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">New</div>
                <div className="mt-1 text-sm font-semibold text-on-surface">{formatMasterValue(nextValue)}</div>
              </div>
            </div>
          </div>
        )) : (
          previewFields.map(({ field, label }) => (
            <div key={field} className="grid grid-cols-[120px,minmax(0,1fr)] gap-3 text-sm">
              <div className="font-semibold text-on-surface-variant">{label}</div>
              <div className="text-on-surface">{formatMasterValue(record[field])}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function MasterBatchEditModal({
  open,
  fieldDefinitions,
  previewRecords,
  totalCount,
  submitting,
  onClose,
  onSubmit,
  loadDistinctOptions,
  tabKey = "masterDB",
}) {
  const tabUI = getMasterTabUI(tabKey);
  const fields = useMemo(
    () => fieldDefinitions.filter((field) => field.field !== "imageURL"),
    [fieldDefinitions]
  );
  const previewFields = useMemo(() => getMasterPreviewFields(tabKey), [tabKey]);
  const [selectedField, setSelectedField] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [changes, setChanges] = useState({});
  const [options, setOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const activeField = fields.find((field) => field.field === selectedField) || null;

  if (!open) return null;

  async function handleFieldSelect(fieldName) {
    const field = fields.find((item) => item.field === fieldName);
    setSelectedField(fieldName);
    setDraftValue(String(changes[fieldName] ?? ""));

    if (!field || !["text", "textarea"].includes(field.type)) {
      setOptions([]);
      setLoadingOptions(false);
      return;
    }

    setLoadingOptions(true);
    try {
      const values = await loadDistinctOptions(field.field);
      setOptions(Array.isArray(values) ? values : []);
    } catch {
      setOptions([]);
    } finally {
      setLoadingOptions(false);
    }
  }

  return (
    <ModalShell
      open={!!open}
      onClose={onClose}
      eyebrow="Batch Edit"
      title={`Update ${totalCount} filtered ${tabUI.recordLabel.toLowerCase()}s`}
      subtitle="Choose one field at a time, build a change set, then apply it across every record that matched the current advanced filter query."
      maxWidth="max-w-7xl"
      overlayOpacity="45"
      cardClassName="max-h-[88vh]"
      footer={
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-on-surface-variant">
            The update runs against every record currently matched by the advanced filter query.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSubmit(changes)}
              disabled={!Object.keys(changes).length || submitting}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Updating…" : "Apply Updates"}
            </button>
          </div>
        </div>
      }
    >
          <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[360px,minmax(0,1fr)]">
            <div className="border-r border-outline-variant/20 bg-surface-container-low px-6 py-5 overflow-y-auto scrollbar-hide">
              <div className="rounded-2xl bg-surface px-4 py-4 border border-separator/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">Available Fields</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {fields.map((field) => (
                    <button
                      key={field.field}
                      type="button"
                      onClick={() => handleFieldSelect(field.field)}
                      className={[
                        "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                        selectedField === field.field
                          ? "bg-primary text-on-primary"
                          : "bg-primary/10 text-primary hover:bg-primary/15",
                      ].join(" ")}
                    >
                      {field.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-surface px-4 py-4 border border-separator/40">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">Edit Field</div>
                    <div className="mt-1 text-sm text-on-surface-variant">{activeField ? activeField.label : "Select a field tag above to start editing."}</div>
                  </div>
                </div>

                {activeField ? (
                  <div className="mt-4 space-y-3">
                    {activeField.type === "textarea" ? (
                      <textarea
                        rows={4}
                        value={draftValue}
                        onChange={(event) => setDraftValue(event.target.value)}
                        className="w-full rounded-2xl border border-outline-variant/30 bg-surface-container px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                      />
                    ) : activeField.field === "品番" || activeField.field === "構成品番" || /品番/i.test(activeField.field) ? (
                      <SearchableHinbanSelect
                        value={draftValue}
                        onChange={({ value }) => setDraftValue(value)}
                        placeholder="Search or select 品番..."
                        className="w-full rounded-2xl border border-outline-variant/30 bg-surface-container px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                      />
                    ) : options.length > 0 || loadingOptions || activeField.type === "select" ? (
                      <SearchableSelect
                        value={draftValue}
                        options={options}
                        onChange={({ value }) => setDraftValue(value)}
                        placeholder={loadingOptions ? `Loading ${activeField.label}...` : `Select or search ${activeField.label}...`}
                        className="w-full rounded-2xl border border-outline-variant/30 bg-surface-container px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                      />
                    ) : (
                      <input
                        type={activeField.type === "number" ? "number" : activeField.type === "date" ? "date" : activeField.type === "time" ? "time" : "text"}
                        value={draftValue}
                        onChange={(event) => setDraftValue(event.target.value)}
                        className="w-full rounded-2xl border border-outline-variant/30 bg-surface-container px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                        placeholder="Enter new value"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (!activeField || draftValue === "") return;
                        setChanges((current) => ({ ...current, [activeField.field]: draftValue }));
                      }}
                      className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150"
                    >
                      Add Change
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl bg-surface px-4 py-4 border border-separator/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">Changes To Apply</div>
                    <div className="mt-1 text-sm text-on-surface-variant">These values will overwrite the selected fields for every matching record.</div>
                  </div>
                  {!!Object.keys(changes).length && (
                    <button
                      type="button"
                      onClick={() => setChanges({})}
                      className="text-xs font-semibold uppercase tracking-[0.18em] text-error"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {Object.keys(changes).length ? Object.entries(changes).map(([field, value]) => (
                    <div key={field} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low px-4 py-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{field}</div>
                        <div className="mt-1 text-sm font-semibold text-on-surface">{String(value)}</div>
                      </div>
                      <IconButton
                        icon="delete"
                        onClick={() => {
                          setChanges((current) => {
                            const next = { ...current };
                            delete next[field];
                            return next;
                          });
                        }}
                        variant="danger"
                        size="md"
                        iconSize={18}
                        ariaLabel="Remove change"
                      />
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-outline-variant/30 px-4 py-6 text-sm text-on-surface-variant">
                      No changes queued yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto px-6 py-5 scrollbar-hide bg-surface-container-lowest/60">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">Live Preview</div>
                  <div className="mt-1 text-sm text-on-surface-variant">Showing {Math.min(5, previewRecords.length)} preview cards from the current page.</div>
                </div>
                <div className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant">
                  {totalCount} total matches
                </div>
              </div>

              <div className="space-y-4">
                {previewRecords.slice(0, 5).map((record, index) => (
                  <PreviewCard
                    key={`${record._id?.$oid || record._id || index}`}
                    record={record}
                    changes={changes}
                    previewFields={previewFields}
                    tabKey={tabKey}
                  />
                ))}
              </div>
            </div>
          </div>
    </ModalShell>
  );
}
