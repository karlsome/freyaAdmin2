import { useState, useEffect } from "react";
import { fetchCheckFormTemplates } from "../services/api";
import CheckFormBuilderModal from "../components/CheckFormBuilderModal";
import CheckFormPreviewModal from "../components/CheckFormPreviewModal";

const STATUS_STYLES = {
  active:   "bg-primary/10 text-primary",
  draft:    "bg-outline/10 text-outline",
  archived: "bg-surface-container text-outline",
};

function FormCard({ form, onPreview, onEdit }) {
  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container shadow-sm overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h5 className="font-bold text-on-surface text-sm leading-tight">{form.name}</h5>
          <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[form.status] ?? STATUS_STYLES.draft}`}>
            {form.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-outline">
          {form.工場 && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>factory</span>
              {form.工場}
            </span>
          )}
          {form.schedule && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
              {form.schedule}
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>list</span>
            {form.fields?.length ?? 0} fields
          </span>
        </div>
      </div>
      <div className="flex border-t border-outline-variant/20">
        <button
          type="button"
          onClick={onPreview}
          className="flex-1 py-2.5 text-xs font-bold text-primary hover:bg-primary/5 transition flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>visibility</span>
          View
        </button>
        <div className="w-px bg-outline-variant/20" />
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 py-2.5 text-xs font-bold text-on-surface hover:bg-surface-container-high transition flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
          Edit
        </button>
      </div>
    </div>
  );
}

const GROUPS = [
  { key: "active",   label: "Active",   labelClass: "text-primary" },
  { key: "draft",    label: "Drafts",   labelClass: "text-outline" },
  { key: "archived", label: "Archived", labelClass: "text-outline" },
];

export default function MaintenancePage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [previewTarget, setPreviewTarget] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCheckFormTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openBuilder(form = null) {
    setEditTarget(form);
    setBuilderOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
    setEditTarget(null);
  }

  const grouped = GROUPS.map((g) => ({
    ...g,
    items: templates.filter((t) => t.status === g.key),
  }));

  return (
    <div className="p-6">
      <section className="glass-card rounded-3xl p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">メンテナンス</p>
            <h3 className="mt-1 text-2xl font-black text-on-surface">Maintenance Forms</h3>
          </div>
          <button
            type="button"
            onClick={() => openBuilder()}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition hover:opacity-90"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            New Form
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-12 text-outline">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            Loading...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>
        )}

        {!loading && !error && templates.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-outline">
            <span className="material-symbols-outlined" style={{ fontSize: 40 }}>checklist</span>
            <p className="text-sm">No forms yet. Create your first maintenance form.</p>
          </div>
        )}

        {!loading && !error && grouped.map(({ key, label, labelClass, items }) =>
          items.length > 0 ? (
            <div key={key} className="mb-8">
              <h4 className={`mb-3 text-xs font-bold uppercase tracking-[0.18em] ${labelClass}`}>{label}</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((form) => (
                  <FormCard
                    key={form._id}
                    form={form}
                    onPreview={() => setPreviewTarget(form)}
                    onEdit={() => openBuilder(form)}
                  />
                ))}
              </div>
            </div>
          ) : null
        )}
      </section>

      {builderOpen && (
        <CheckFormBuilderModal
          initial={editTarget}
          onClose={closeBuilder}
          onSaved={() => { closeBuilder(); load(); }}
        />
      )}

      {previewTarget && (
        <CheckFormPreviewModal
          form={previewTarget}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </div>
  );
}
