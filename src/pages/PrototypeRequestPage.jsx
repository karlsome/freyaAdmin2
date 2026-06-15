import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import SensorDevicePhotoPreviewModal from "../components/SensorDevicePhotoPreviewModal";
import {
  BASE_URL,
  deleteShisakuRequest,
  fetchShisakuList,
  fetchShisakuRequestList,
  registerShisakuRequest,
} from "../services/api";

const EMPTY_ENTRY = {
  name: "",
  okuriPitch: "",
  color: "",
  material: "",
  boxType: "",
  quantity: "",
};

function FlashBanner({ flash, onClose }) {
  if (!flash) return null;

  const tone = flash.type === "error"
    ? "bg-error/10 text-error border-error/20"
    : flash.type === "success"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";

  return (
    <div className={`mb-6 rounded-3xl border px-5 py-4 ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">Status</div>
          <p className="mt-1 text-sm font-medium">{flash.message}</p>
        </div>
        <button type="button" onClick={onClose} className="text-current/70 transition hover:text-current">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

const inputClassName = "rounded-xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none";
const readOnlyInputClassName = "rounded-xl border border-outline-variant/20 bg-surface-container px-3 py-2 text-sm text-on-surface-variant truncate";

// Older records stored Drive's webViewLink ("/file/d/<id>/view...") for pdfjpglink, which the
// browser can't render as an <img> (it redirects to a Google login page). Rewrite those to the
// backend's streaming proxy so previews work for records created before that fix too.
function normalizeJpgLink(link) {
  if (!link) return "";
  const match = String(link).match(/\/file\/d\/([^/]+)/);
  return match ? `${BASE_URL}api/shisaku/image/${match[1]}` : link;
}

function buildPceOptions(shisakuRecords) {
  const options = [];

  for (const record of shisakuRecords || []) {
    const recordId = record?._id?.$oid || record?._id;
    const pceLinks = Array.isArray(record.pcelinks) && record.pcelinks.length > 0
      ? record.pcelinks
      : (record.pcelink ? [{ name: "pce", link: record.pcelink }] : []);

    pceLinks.forEach((entry, idx) => {
      const pceName = entry?.name || "pce";
      options.push({
        value: `${recordId}-${idx}`,
        label: record.shisakuNo ? `試作${record.shisakuNo} — ${pceName}` : pceName,
        pceName,
        pdfLink: normalizeJpgLink(record.pdfjpglink || record.pdflink || ""),
      });
    });
  }

  return options;
}

export default function PrototypeRequestPage() {
  const [shisakuRecords, setShisakuRecords] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [selectedPceKey, setSelectedPceKey] = useState("");
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(null), 4500);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [shisakuData, requestData] = await Promise.all([
          fetchShisakuList(),
          fetchShisakuRequestList(),
        ]);
        if (cancelled) return;
        setShisakuRecords(Array.isArray(shisakuData) ? shisakuData : []);
        setRecords(Array.isArray(requestData) ? requestData : []);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load prototype request data.");
        setShisakuRecords([]);
        setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [refreshNonce]);

  const pceOptions = useMemo(() => buildPceOptions(shisakuRecords), [shisakuRecords]);
  const selectedOption = useMemo(
    () => pceOptions.find((option) => option.value === selectedPceKey) || null,
    [pceOptions, selectedPceKey]
  );

  function handleEntryChange(key, value) {
    setEntry((current) => ({ ...current, [key]: value }));
  }

  function resetEntry() {
    setSelectedPceKey("");
    setEntry(EMPTY_ENTRY);
  }

  const canRegister = (
    !!selectedOption &&
    entry.name.trim() &&
    entry.okuriPitch !== "" &&
    entry.color.trim() &&
    entry.material.trim() &&
    entry.boxType.trim() &&
    entry.quantity !== "" &&
    !submitting
  );

  async function handleRegister() {
    if (!canRegister) return;
    setSubmitting(true);

    try {
      await registerShisakuRequest({
        name: entry.name.trim(),
        pce: selectedOption.pceName,
        okuriPitch: Number(entry.okuriPitch),
        color: entry.color.trim(),
        material: entry.material.trim(),
        boxType: entry.boxType.trim(),
        quantity: Number(entry.quantity),
        pdfLink: selectedOption.pdfLink,
      });

      setFlash({ type: "success", message: "Prototype request registered successfully." });
      resetEntry();
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setFlash({ type: "error", message: err.message || "Registration failed." });
    } finally {
      setSubmitting(false);
    }
  }

  function openPdfPreview(rawUrl, label) {
    const url = normalizeJpgLink(rawUrl);
    if (!url) return;
    setPreviewImage({
      eyebrow: "PDF Preview",
      displayName: label || "PDF preview",
      activeIndex: 0,
      images: [{ url, label }],
    });
  }

  function handlePreviewNavigate(direction) {
    setPreviewImage((current) => {
      const images = Array.isArray(current?.images) ? current.images : [];
      const currentIndex = Number.isInteger(current?.activeIndex) ? current.activeIndex : 0;
      const nextIndex = currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= images.length) {
        return current;
      }

      return {
        ...current,
        activeIndex: nextIndex,
      };
    });
  }

  async function handleDelete(record) {
    const id = record?._id?.$oid || record?._id;
    if (!id) return;

    const label = record.name || "this request";
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    setDeletingId(id);
    try {
      await deleteShisakuRequest(id);
      setFlash({ type: "success", message: `${label} deleted.` });
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setFlash({ type: "error", message: err.message || "Failed to delete record." });
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo(() => [
    { key: "name", label: "Name", sortable: false, width: 140, renderCell: (r) => r.name || "—" },
    { key: "pce", label: "PCE", sortable: false, width: 180, renderCell: (r) => r.pce || "—" },
    { key: "okuriPitch", label: "Okuri Pitch", sortable: false, width: 110, align: "center", renderCell: (r) => r.okuriPitch ?? "—" },
    { key: "color", label: "Color", sortable: false, width: 120, renderCell: (r) => r.color || "—" },
    { key: "material", label: "Material", sortable: false, width: 120, renderCell: (r) => r.material || "—" },
    { key: "boxType", label: "Box Type", sortable: false, width: 120, renderCell: (r) => r.boxType || "—" },
    { key: "quantity", label: "Quantity", sortable: false, width: 100, align: "center", renderCell: (r) => r.quantity ?? "—" },
    {
      key: "pdfLink",
      label: "PDF",
      sortable: false,
      width: 90,
      align: "center",
      disableCellWrapper: true,
      renderCell: (r) => (
        r.pdfLink ? (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => openPdfPreview(r.pdfLink, r.name ? `${r.name} — PDF` : "PDF")}
              className="inline-flex items-center justify-center rounded-lg border border-outline-variant/30 bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase text-primary transition hover:bg-surface-container-high"
            >
              pdf
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span className="inline-flex items-center justify-center rounded-lg border border-outline-variant/15 bg-surface-container px-2.5 py-1 text-[11px] font-semibold uppercase text-on-surface-variant/40">
              pdf
            </span>
          </div>
        )
      ),
    },
    {
      key: "createdAt",
      label: "Registered",
      sortable: false,
      width: 140,
      renderCell: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—",
    },
    {
      key: "actions",
      label: "",
      sortable: false,
      width: 90,
      align: "center",
      disableCellWrapper: true,
      renderCell: (r) => {
        const id = r?._id?.$oid || r?._id;
        const isDeleting = deletingId === id;
        return (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => handleDelete(r)}
              disabled={isDeleting}
              title="Delete"
              className="inline-flex items-center justify-center rounded-lg border border-error/20 bg-error/5 p-1.5 text-error transition hover:bg-error/10 disabled:opacity-40"
            >
              {isDeleting
                ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>}
            </button>
          </div>
        );
      },
    },
  ], [deletingId]);

  return (
    <section className="pt-24 pb-16 px-4 md:px-8 overflow-y-auto h-screen scrollbar-hide">
      <PageHeader
        title="Prototype Request"
        subtitle="Select an uploaded 試作 PCE file and register a request for it."
      />

      <FlashBanner flash={flash} onClose={() => setFlash(null)} />

      <div className="dashboard-section rounded-2xl overflow-hidden mb-6">
        <div className="border-b border-separator/40 px-4 py-4">
          <h3 className="text-xs font-semibold text-on-surface">New Prototype Request</h3>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          <Field label="PCE File">
            <select
              value={selectedPceKey}
              onChange={(e) => setSelectedPceKey(e.target.value)}
              className={inputClassName}
            >
              <option value="">-- Select a 試作 PCE file --</option>
              {pceOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {pceOptions.length === 0 && (
              <p className="text-[11px] text-on-surface-variant">No PCE files available. Register a 試作 with a PCE file first.</p>
            )}
          </Field>

          {selectedOption && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-8">
              <Field label="Name">
                <input
                  type="text"
                  value={entry.name}
                  onChange={(e) => handleEntryChange("name", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="PCE">
                <p className={readOnlyInputClassName} title={selectedOption.pceName}>{selectedOption.pceName}</p>
              </Field>
              <Field label="Okuri Pitch">
                <input
                  type="number"
                  value={entry.okuriPitch}
                  onChange={(e) => handleEntryChange("okuriPitch", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Color">
                <input
                  type="text"
                  value={entry.color}
                  onChange={(e) => handleEntryChange("color", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Material">
                <input
                  type="text"
                  value={entry.material}
                  onChange={(e) => handleEntryChange("material", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Box Type">
                <input
                  type="text"
                  value={entry.boxType}
                  onChange={(e) => handleEntryChange("boxType", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Quantity">
                <input
                  type="number"
                  value={entry.quantity}
                  onChange={(e) => handleEntryChange("quantity", e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="PDF">
                {selectedOption.pdfLink ? (
                  <button
                    type="button"
                    onClick={() => openPdfPreview(selectedOption.pdfLink, selectedOption.label)}
                    title="View PDF preview"
                    className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-outline-variant/30 bg-surface text-primary transition hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>picture_as_pdf</span>
                  </button>
                ) : (
                  <span
                    title="No PDF preview available"
                    className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-outline-variant/15 bg-surface-container text-on-surface-variant/40"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>picture_as_pdf</span>
                  </span>
                )}
              </Field>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetEntry}
              disabled={!selectedOption}
              className="rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container-high disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRegister}
              disabled={!canRegister}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              {submitting
                ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>}
              {submitting ? "Registering…" : "Register"}
            </button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={records}
        loading={loading}
        error={error}
        sort={{ column: null, direction: 1 }}
        page={1}
        pageSize={records.length || 1}
        filteredCount={records.length}
        totalPages={1}
        onSort={null}
        onPageChange={null}
        onPageSizeChange={null}
        pageSizeOptions={[]}
        stickyHeader
        className="overflow-hidden"
        emptyTitle="No prototype requests registered"
        emptyMessage="Select a PCE file above to register the first request."
        rowKey={(row, rowIndex) => row?._id?.$oid || row?._id || rowIndex}
      />

      <SensorDevicePhotoPreviewModal
        preview={previewImage}
        onClose={() => setPreviewImage(null)}
        onNavigate={handlePreviewNavigate}
      />
    </section>
  );
}
