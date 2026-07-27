import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import ModalShell from "../components/ModalShell";
import { deleteShisaku, fetchShisakuList, registerShisaku } from "../services/api";
import { convertPdfFileToPreviewImage } from "../utils/productPDFs";

const EMPTY_FORM = {
  shisakuNo: "",
  deadline: "",
  eventName: "",
  modelName: "",
  customerName: "",
  registeredBy: "",
  cybozuLink: "",
};

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

function buildFileName(shisakuNo, originalName) {
  const trimmed = String(shisakuNo || "").trim();
  if (!trimmed || !originalName) return "";
  return `試作${trimmed}_${originalName}`;
}

function buildJpgFileName(fileName) {
  if (!fileName) return "";
  return fileName.replace(/\.[^.]+$/, "") + ".jpg";
}

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

function FileUploadField({ label, accept, file, fileName, onSelect, disabled, editable, onNameChange }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-outline-variant/20 bg-surface-container px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{label}</span>
        <label className={`inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload_file</span>
          {file ? "Replace" : "Upload"}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={disabled}
            onChange={(e) => onSelect(e.target.files?.[0] || null)}
          />
        </label>
      </div>

      {file ? (
        editable ? (
          <input
            type="text"
            value={fileName}
            onChange={(e) => onNameChange(e.target.value)}
            className={`${inputClassName} font-mono text-xs`}
          />
        ) : (
          <p className="truncate rounded-lg bg-surface px-3 py-2 font-mono text-xs text-on-surface" title={fileName}>
            {fileName}
          </p>
        )
      ) : (
        <p className="text-[11px] text-on-surface-variant">{disabled ? "Enter 試作番号 first" : "No file selected"}</p>
      )}
    </div>
  );
}

function PceUploadList({ files, onAdd, onRemove, onRename, disabled }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-outline-variant/20 bg-surface-container px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">PCE</span>
        <label className={`inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload_file</span>
          {files.length ? "Add more" : "Upload"}
          <input
            type="file"
            accept=".pce"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              onAdd(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {files.length === 0 ? (
        <p className="text-[11px] text-on-surface-variant">{disabled ? "Enter 試作番号 first" : "No files selected"}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {files.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2">
              <input
                type="text"
                value={entry.name}
                onChange={(e) => onRename(entry.id, e.target.value)}
                className={`${inputClassName} font-mono text-xs flex-1`}
              />
              <button
                type="button"
                onClick={() => onRemove(entry.id)}
                title="Remove"
                className="flex-shrink-0 rounded-lg border border-outline-variant/30 bg-surface p-1.5 text-on-surface-variant transition hover:bg-error/10 hover:text-error"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PrototypePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dxfFile, setDxfFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [pceFiles, setPceFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(null), 4500);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecords() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchShisakuList();
        if (cancelled) return;
        setRecords(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load prototype records.");
        setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRecords();
    return () => { cancelled = true; };
  }, [refreshNonce]);

  const dxfFileName = useMemo(() => buildFileName(form.shisakuNo, dxfFile?.name), [form.shisakuNo, dxfFile]);
  const pdfFileName = useMemo(() => buildFileName(form.shisakuNo, pdfFile?.name), [form.shisakuNo, pdfFile]);

  useEffect(() => {
    setPceFiles((current) => current.map((entry) => (
      entry.touched ? entry : { ...entry, name: buildFileName(form.shisakuNo, entry.file.name) }
    )));
  }, [form.shisakuNo]);

  function handleFieldChange(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleFileSelect(kind, file) {
    if (!file) return;
    if (kind === "dxf") setDxfFile(file);
    if (kind === "pdf") setPdfFile(file);
  }

  function handlePceFilesAdd(files) {
    if (!files?.length) return;
    setPceFiles((current) => [
      ...current,
      ...files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        name: buildFileName(form.shisakuNo, file.name),
        touched: false,
      })),
    ]);
  }

  function handlePceFileRemove(id) {
    setPceFiles((current) => current.filter((entry) => entry.id !== id));
  }

  function handlePceFileRename(id, name) {
    setPceFiles((current) => current.map((entry) => (
      entry.id === id ? { ...entry, name, touched: true } : entry
    )));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setDxfFile(null);
    setPdfFile(null);
    setPceFiles([]);
  }

  const shisakuNoEntered = form.shisakuNo.trim().length > 0;

  const canRegister = (
    shisakuNoEntered &&
    form.deadline &&
    form.eventName.trim() &&
    form.modelName.trim() &&
    form.customerName.trim() &&
    form.registeredBy.trim() &&
    form.cybozuLink.trim() &&
    !!dxfFile && !!pdfFile &&
    !!dxfFileName && !!pdfFileName &&
    pceFiles.length > 0 && pceFiles.every((entry) => entry.name.trim()) &&
    !submitting
  );

  async function handleRegister() {
    if (!canRegister) return;
    setSubmitting(true);

    try {
      const [dxfBase64, pdfBase64, pdfImageDataUrl, ...pceBase64List] = await Promise.all([
        toBase64(dxfFile),
        toBase64(pdfFile),
        convertPdfFileToPreviewImage(pdfFile),
        ...pceFiles.map((entry) => toBase64(entry.file)),
      ]);
      const pdfImageBase64 = pdfImageDataUrl.split(",")[1] || "";

      const shisakuNo = form.shisakuNo.trim();

      await registerShisaku({
        shisakuNo,
        deadline: form.deadline,
        eventName: form.eventName.trim(),
        modelName: form.modelName.trim(),
        customerName: form.customerName.trim(),
        registeredBy: form.registeredBy.trim(),
        cybozuLink: form.cybozuLink.trim(),
        dxfFile: { name: dxfFileName, base64: dxfBase64 },
        pdfFile: { name: pdfFileName, base64: pdfBase64 },
        pdfImageFile: { name: buildJpgFileName(pdfFileName), base64: pdfImageBase64 },
        pceFiles: pceFiles.map((entry, idx) => ({ name: entry.name.trim(), base64: pceBase64List[idx] })),
      });

      setFlash({ type: "success", message: `試作${shisakuNo} registered successfully.` });
      resetForm();
      setFormOpen(false);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setFlash({ type: "error", message: err.message || "Registration failed." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(record) {
    const id = record?._id?.$oid || record?._id;
    if (!id) return;

    const label = record.shisakuNo ? `試作${record.shisakuNo}` : "this record";
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    setDeletingId(id);
    try {
      await deleteShisaku(id);
      setFlash({ type: "success", message: `${label} deleted.` });
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setFlash({ type: "error", message: err.message || "Failed to delete record." });
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo(() => [
    { key: "shisakuNo", label: "試作番号", sortable: false, width: 120, renderCell: (r) => r.shisakuNo || "—" },
    { key: "deadline", label: "Deadline", sortable: false, width: 130, renderCell: (r) => r.deadline || "—" },
    { key: "eventName", label: "Event", sortable: false, width: 160, renderCell: (r) => r.eventName || "—" },
    { key: "modelName", label: "Model", sortable: false, width: 160, renderCell: (r) => r.modelName || "—" },
    { key: "customerName", label: "Customer", sortable: false, width: 160, renderCell: (r) => r.customerName || "—" },
    {
      key: "files",
      label: "Files",
      sortable: false,
      width: 200,
      align: "center",
      disableCellWrapper: true,
      renderCell: (r) => {
        const pceLinks = Array.isArray(r.pcelinks) && r.pcelinks.length > 0
          ? r.pcelinks
          : (r.pcelink ? [{ name: "pce", link: r.pcelink }] : []);

        return (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[["dxf", r.dxflink], ["pdf", r.pdflink]].map(([label, link]) => (
              link ? (
                <a
                  key={label}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-outline-variant/30 bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase text-primary transition hover:bg-surface-container-high"
                >
                  {label}
                </a>
              ) : (
                <span key={label} className="inline-flex items-center justify-center rounded-lg border border-outline-variant/15 bg-surface-container px-2.5 py-1 text-[11px] font-semibold uppercase text-on-surface-variant/40">
                  {label}
                </span>
              )
            ))}
            {pceLinks.length > 0 ? (
              pceLinks.map((entry, idx) => (
                <a
                  key={`pce-${idx}`}
                  href={entry.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={entry.name}
                  className="inline-flex items-center justify-center rounded-lg border border-outline-variant/30 bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase text-primary transition hover:bg-surface-container-high"
                >
                  {pceLinks.length > 1 ? `pce${idx + 1}` : "pce"}
                </a>
              ))
            ) : (
              <span className="inline-flex items-center justify-center rounded-lg border border-outline-variant/15 bg-surface-container px-2.5 py-1 text-[11px] font-semibold uppercase text-on-surface-variant/40">
                pce
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "cybozuLink",
      label: "Cybozu",
      sortable: false,
      width: 90,
      align: "center",
      disableCellWrapper: true,
      renderCell: (r) => (
        r.cybozuLink ? (
          <div className="flex items-center justify-center">
            <a
              href={r.cybozuLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in Cybozu"
              className="inline-flex items-center justify-center rounded-lg border border-primary/20 bg-primary/10 p-1.5 text-primary transition hover:bg-primary/20"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
            </a>
          </div>
        ) : "—"
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
        title="Prototype Management"
        subtitle="Register new 試作 entries and manage their DXF, PDF, and PCE files."
        actions={(
          <button
            type="button"
            onClick={() => {
              if (formOpen) resetForm();
              setFormOpen((open) => !open);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition-all hover:opacity-90"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{formOpen ? "close" : "add"}</span>
            {formOpen ? "Cancel" : "register new 試作"}
          </button>
        )}
      />

      <FlashBanner flash={flash} onClose={() => setFlash(null)} />

      <ModalShell
        open={formOpen}
        onClose={() => { resetForm(); setFormOpen(false); }}
        title="New 試作 Registration"
        subtitle="Fill in the required information and upload files for the new 試作."
        maxWidth="max-w-4xl"
      >
        <div className="px-6 py-4 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="試作番号">
              <input
                type="text"
                value={form.shisakuNo}
                onChange={(e) => handleFieldChange("shisakuNo", e.target.value)}
                placeholder="4153"
                className={inputClassName}
              />
            </Field>
            <Field label="Deadline">
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => handleFieldChange("deadline", e.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Event">
              <input
                type="text"
                value={form.eventName}
                onChange={(e) => handleFieldChange("eventName", e.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Model">
              <input
                type="text"
                value={form.modelName}
                onChange={(e) => handleFieldChange("modelName", e.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Customer">
              <input
                type="text"
                value={form.customerName}
                onChange={(e) => handleFieldChange("customerName", e.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Registered By">
              <input
                type="text"
                value={form.registeredBy}
                onChange={(e) => handleFieldChange("registeredBy", e.target.value)}
                className={inputClassName}
              />
            </Field>
          </div>
          
          <Field label="Cybozu Link">
            <input
              type="url"
              value={form.cybozuLink}
              onChange={(e) => handleFieldChange("cybozuLink", e.target.value)}
              placeholder="https://sasaki-coating.cybozu.com/..."
              className={inputClassName}
            />
          </Field>

          {!shisakuNoEntered && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <span className="material-symbols-outlined text-amber-500 flex-shrink-0" style={{ fontSize: 14 }}>warning</span>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                Enter a 試作番号 first — uploaded file names are generated from it (試作{"{number}"}_filename).
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <FileUploadField
              label="DXF"
              accept=".dxf"
              file={dxfFile}
              fileName={dxfFileName}
              onSelect={(f) => handleFileSelect("dxf", f)}
              disabled={!shisakuNoEntered}
            />
            <FileUploadField
              label="PDF"
              accept=".pdf"
              file={pdfFile}
              fileName={pdfFileName}
              onSelect={(f) => handleFileSelect("pdf", f)}
              disabled={!shisakuNoEntered}
            />
            <PceUploadList
              files={pceFiles}
              onAdd={handlePceFilesAdd}
              onRemove={handlePceFileRemove}
              onRename={handlePceFileRename}
              disabled={!shisakuNoEntered}
            />
          </div>
        </div>
        
        <div className="border-t border-separator/40 bg-surface-container/30 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={() => { resetForm(); setFormOpen(false); }}
            className="rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container-high"
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
      </ModalShell>

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
        emptyTitle="No prototypes registered"
        emptyMessage="Use “register new 試作” to add the first entry."
        rowKey={(row, rowIndex) => row?._id?.$oid || row?._id || rowIndex}
      />
    </section>
  );
}
