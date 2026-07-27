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

function FileUploadList({ label, accept, files, onAdd, onRemove, onRename, disabled }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-outline-variant/20 bg-surface-container px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{label}</span>
        <label className={`inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload_file</span>
          {files.length ? "Add more" : "Upload"}
          <input
            type="file"
            accept={accept}
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
  
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  
  const [sort, setSort] = useState({ column: "createdAt", direction: -1 });

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dxfFiles, setDxfFiles] = useState([]);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [pceFiles, setPceFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editDxfFiles, setEditDxfFiles] = useState([]);
  const [editPdfFiles, setEditPdfFiles] = useState([]);
  const [editPceFiles, setEditPceFiles] = useState([]);
  const [editSubmitting, setEditSubmitting] = useState(false);

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
        const data = await fetchShisakuList({
          page,
          limit: pageSize,
          sortColumn: sort.column,
          sortDirection: sort.direction,
        });
        if (cancelled) return;
        setRecords(data?.rows || []);
        setTotalPages(data?.pagination?.totalPages || 1);
        setFilteredCount(data?.pagination?.totalCount || 0);
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
  }, [refreshNonce, page, pageSize, sort]);

  
  

  
  useEffect(() => {
    const renameFn = (current) => current.map((entry) => (
      entry.touched || !entry.file ? entry : { ...entry, name: buildFileName(form.shisakuNo, entry.file.name) }
    ));
    setDxfFiles(renameFn);
    setPdfFiles(renameFn);
    setPceFiles(renameFn);
  }, [form.shisakuNo]);


  function handleFieldChange(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  
  function createFilesAddHandler(setter) {
    return (files) => {
      if (!files?.length) return;
      setter((current) => [
        ...current,
        ...files.map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          name: buildFileName(form.shisakuNo, file.name),
          touched: false,
        })),
      ]);
    };
  }
  
  function createFileRemoveHandler(setter) {
    return (id) => setter((current) => current.filter((entry) => entry.id !== id));
  }
  
  function createFileRenameHandler(setter) {
    return (id, name) => setter((current) => current.map((entry) => (
      entry.id === id ? { ...entry, name, touched: true } : entry
    )));
  }

  const handleDxfFilesAdd = createFilesAddHandler(setDxfFiles);
  const handleDxfFileRemove = createFileRemoveHandler(setDxfFiles);
  const handleDxfFileRename = createFileRenameHandler(setDxfFiles);

  const handlePdfFilesAdd = createFilesAddHandler(setPdfFiles);
  const handlePdfFileRemove = createFileRemoveHandler(setPdfFiles);
  const handlePdfFileRename = createFileRenameHandler(setPdfFiles);

  const handlePceFilesAdd = createFilesAddHandler(setPceFiles);
  const handlePceFileRemove = createFileRemoveHandler(setPceFiles);
  const handlePceFileRename = createFileRenameHandler(setPceFiles);
  function resetForm() {
    setForm(EMPTY_FORM);
    setDxfFiles([]);
    setPdfFiles([]);
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
    dxfFiles.length > 0 && dxfFiles.every(e => e.name.trim()) && pdfFiles.length > 0 && pdfFiles.every(e => e.name.trim()) &&
    pceFiles.length > 0 && pceFiles.every((entry) => entry.name.trim()) &&
    !submitting
  );

  async function handleRegister() {
    if (!canRegister) return;
    setSubmitting(true);

    try {
      
      const dxfBase64List = await Promise.all(dxfFiles.map(e => toBase64(e.file)));
      const pdfBase64List = await Promise.all(pdfFiles.map(e => toBase64(e.file)));
      const pdfImageUrls = await Promise.all(pdfFiles.map(e => convertPdfFileToPreviewImage(e.file)));
      const pceBase64List = await Promise.all(pceFiles.map(e => toBase64(e.file)));


      const shisakuNo = form.shisakuNo.trim();

      await registerShisaku({
        shisakuNo,
        deadline: form.deadline,
        eventName: form.eventName.trim(),
        modelName: form.modelName.trim(),
        customerName: form.customerName.trim(),
        registeredBy: form.registeredBy.trim(),
        cybozuLink: form.cybozuLink.trim(),
        dxfFiles: dxfFiles.map((e, i) => ({ name: e.name.trim(), base64: dxfBase64List[i] })),
        pdfFiles: pdfFiles.map((e, i) => ({ name: e.name.trim(), base64: pdfBase64List[i] })),
        pdfImageFiles: pdfFiles.map((e, i) => ({ name: buildJpgFileName(e.name.trim()), base64: (pdfImageUrls[i] || "").split(",")[1] || "" })),
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

  function handleOpenEditModal(record) {
    setEditForm({
      shisakuNo: record.shisakuNo || "",
      deadline: record.deadline || "",
      eventName: record.eventName || "",
      modelName: record.modelName || "",
      customerName: record.customerName || "",
      registeredBy: record.registeredBy || "",
      cybozuLink: record.cybozuLink || "",
      _id: record._id,
    });
    setEditDxfFiles((record.dxfLinks || (record.dxflink ? [{name: 'DXF', link: record.dxflink}] : [])).map(l => ({ id: Math.random().toString(), name: l.name, link: l.link })));
    setEditPdfFiles((record.pdfLinks || (record.pdflink ? [{name: 'PDF', link: record.pdflink}] : [])).map(l => ({ id: Math.random().toString(), name: l.name, link: l.link })));
    setEditPceFiles((record.pcelinks || (record.pcelink ? [{name: 'PCE', link: record.pcelink}] : [])).map(l => ({ id: Math.random().toString(), name: l.name, link: l.link })));
    
    setSelectedRecord(null);
    setEditFormOpen(true);
  }

  const handleEditDxfFilesAdd = createFilesAddHandler(setEditDxfFiles);
  const handleEditDxfFileRemove = createFileRemoveHandler(setEditDxfFiles);
  const handleEditDxfFileRename = createFileRenameHandler(setEditDxfFiles);

  const handleEditPdfFilesAdd = createFilesAddHandler(setEditPdfFiles);
  const handleEditPdfFileRemove = createFileRemoveHandler(setEditPdfFiles);
  const handleEditPdfFileRename = createFileRenameHandler(setEditPdfFiles);

  const handleEditPceFilesAdd = createFilesAddHandler(setEditPceFiles);
  const handleEditPceFileRemove = createFileRemoveHandler(setEditPceFiles);
  const handleEditPceFileRename = createFileRenameHandler(setEditPceFiles);

  async function handleEditSubmit() {
    setEditSubmitting(true);
    try {
      const processMixedFiles = async (files) => {
        return Promise.all(files.map(async f => {
          if (f.link) return { name: f.name, link: f.link };
          const base64 = await toBase64(f.file);
          return { name: f.name.trim(), base64 };
        }));
      };

      const dxfPayload = await processMixedFiles(editDxfFiles);
      const pdfPayload = await processMixedFiles(editPdfFiles);
      const pcePayload = await processMixedFiles(editPceFiles);

      const pdfImagePayload = await Promise.all(editPdfFiles.map(async (f) => {
        if (f.link) return { name: f.name, link: f.link }; // We just pass link, backend will reuse pdfJpgLink? Wait, we didn't store pdfJpgLink mapping here. Actually backend will just keep existing. 
        // For new files:
        const previewUrl = await convertPdfFileToPreviewImage(f.file);
        return { name: buildJpgFileName(f.name.trim()), base64: previewUrl.split(",")[1] || "" };
      }));

      const id = editForm._id?.$oid || editForm._id;
      await updateShisaku(id, {
        ...editForm,
        dxfFiles: dxfPayload,
        pdfFiles: pdfPayload,
        pdfImageFiles: pdfImagePayload,
        pceFiles: pcePayload,
      });

      setFlash({ type: "success", message: `試作${editForm.shisakuNo} updated successfully.` });
      setEditFormOpen(false);
      setRefreshNonce(c => c + 1);
    } catch (err) {
      setFlash({ type: "error", message: err.message || "Update failed." });
    } finally {
      setEditSubmitting(false);
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

  function handleSort(column) {
    setSort((current) => {
      const nextSort = current.column === column
        ? { column, direction: current.direction === 1 ? -1 : 1 }
        : { column, direction: 1 };
      setPage(1); // Reset to page 1 on sort change
      return nextSort;
    });
  }

  const columns = useMemo(() => [
    { key: "shisakuNo", label: "試作番号", width: 120, renderCell: (r) => r.shisakuNo || "—" },
    { key: "deadline", label: "Deadline", width: 130, renderCell: (r) => r.deadline || "—" },
    { key: "eventName", label: "Event", width: 160, renderCell: (r) => r.eventName || "—" },
    { key: "modelName", label: "Model", width: 160, renderCell: (r) => r.modelName || "—" },
    { key: "customerName", label: "Customer", width: 160, renderCell: (r) => r.customerName || "—" },
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
                  onClick={(e) => e.stopPropagation()}
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
                  onClick={(e) => e.stopPropagation()}
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
              onClick={(e) => e.stopPropagation()}
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
          <FileUploadList
            label="DXF"
            accept=".dxf"
            files={dxfFiles}
            onAdd={handleDxfFilesAdd}
            onRemove={handleDxfFileRemove}
            onRename={handleDxfFileRename}
            disabled={!shisakuNoEntered}
          />
          <FileUploadList
            label="PDF"
            accept=".pdf"
            files={pdfFiles}
            onAdd={handlePdfFilesAdd}
            onRemove={handlePdfFileRemove}
            onRename={handlePdfFileRename}
            disabled={!shisakuNoEntered}
          />
          <FileUploadList
            label="PCE"
            accept=".pce"
            files={pceFiles}
            onAdd={handlePceFilesAdd}
            onRemove={handlePceFileRemove}
            onRename={handlePceFileRename}
            disabled={!shisakuNoEntered}
          />
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

      <ModalShell
        open={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={`試作 ${selectedRecord?.shisakuNo || "Details"}`}
        subtitle="Prototype Information and Files"
        maxWidth="max-w-2xl"
      >
        {selectedRecord && (() => {
          const hasAnyFile = (selectedRecord.dxfLinks?.length > 0) || (selectedRecord.pdfLinks?.length > 0) || (selectedRecord.pcelinks?.length > 0) || selectedRecord.dxflink || selectedRecord.pdflink;
          
          return (
            <div className="px-6 py-4 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-on-surface-variant mb-1">
                    Deadline
                  </h3>
                  <p className="text-base text-on-surface">{selectedRecord.deadline || "—"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-on-surface-variant mb-1">
                    Event
                  </h3>
                  <p className="text-base text-on-surface">{selectedRecord.eventName || "—"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-on-surface-variant mb-1">
                    Model
                  </h3>
                  <p className="text-base text-on-surface">{selectedRecord.modelName || "—"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-on-surface-variant mb-1">
                    Customer
                  </h3>
                  <p className="text-base text-on-surface">{selectedRecord.customerName || "—"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-on-surface-variant mb-1">
                    Registered By
                  </h3>
                  <p className="text-base text-on-surface">{selectedRecord.registeredBy || "—"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-on-surface-variant mb-1">
                    Registered At
                  </h3>
                  <p className="text-base text-on-surface">
                    {selectedRecord.createdAt ? new Date(selectedRecord.createdAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                
                <div className="col-span-1 sm:col-span-3">
                  <h3 className="text-sm font-medium text-on-surface-variant mb-1">
                    Cybozu
                  </h3>
                  {selectedRecord.cybozuLink ? (
                    <a
                      href={selectedRecord.cybozuLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-base text-primary transition hover:text-primary/80"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>link</span>
                      Open Cybozu Link
                    </a>
                  ) : (
                    <p className="text-base text-on-surface-variant/50">No link provided</p>
                  )}
                </div>
              </div>

              {hasAnyFile && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-medium text-on-surface-variant mb-1">Files</h3>
                  <div className="flex flex-col gap-4">
                    {/* Legacy format rendering */}
                    {(selectedRecord.dxflink || selectedRecord.pdflink) && (
                      <div className="flex flex-wrap gap-2">
                        {[
                          ["DXF", selectedRecord.dxflink],
                          ["PDF", selectedRecord.pdflink]
                        ].map(([label, link]) => (
                          link ? (
                            <a key={label} href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-surface-container-high">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>description</span>
                              {label}
                            </a>
                          ) : null
                        ))}
                      </div>
                    )}

                    {/* Arrays format rendering */}
                    {(selectedRecord.dxfLinks?.length > 0) && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1.5">DXF Files</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedRecord.dxfLinks.map((entry, idx) => (
                            <a key={idx} href={entry.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-surface-container-high">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>draw</span>
                              {entry.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {(selectedRecord.pdfLinks?.length > 0) && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1.5">PDF Files</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedRecord.pdfLinks.map((entry, idx) => (
                            <a key={idx} href={entry.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-surface-container-high">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>picture_as_pdf</span>
                              {entry.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedRecord.pcelinks?.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1.5">PCE Files</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedRecord.pcelinks.map((entry, idx) => (
                            <a key={idx} href={entry.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-surface-container-high">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>code</span>
                              {entry.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        
        <div className="border-t border-separator/40 bg-surface-container/30 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={() => setSelectedRecord(null)}
            className="rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container-high"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => handleOpenEditModal(selectedRecord)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition-all hover:opacity-90 active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
            Edit
          </button>
        </div>
      </ModalShell>
      <ModalShell
        open={editFormOpen}
        onClose={() => setEditFormOpen(false)}
        title={`Edit 試作 ${editForm.shisakuNo}`}
        subtitle="Update details and manage files"
        maxWidth="max-w-2xl"
      >
        <div className="px-6 py-4 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="試作番号">
              <input
                type="text"
                value={editForm.shisakuNo}
                onChange={(e) => setEditForm(c => ({...c, shisakuNo: e.target.value}))}
                placeholder="e.g. 0000"
                className={inputClassName}
              />
            </Field>
            <Field label="Deadline">
              <input
                type="date"
                value={editForm.deadline}
                onChange={(e) => setEditForm(c => ({...c, deadline: e.target.value}))}
                className={inputClassName}
              />
            </Field>
            <Field label="Event">
              <input
                type="text"
                value={editForm.eventName}
                onChange={(e) => setEditForm(c => ({...c, eventName: e.target.value}))}
                className={inputClassName}
              />
            </Field>
            <Field label="Model">
              <input
                type="text"
                value={editForm.modelName}
                onChange={(e) => setEditForm(c => ({...c, modelName: e.target.value}))}
                className={inputClassName}
              />
            </Field>
            <Field label="Customer">
              <input
                type="text"
                value={editForm.customerName}
                onChange={(e) => setEditForm(c => ({...c, customerName: e.target.value}))}
                className={inputClassName}
              />
            </Field>
            <Field label="Registered By">
              <input
                type="text"
                value={editForm.registeredBy}
                onChange={(e) => setEditForm(c => ({...c, registeredBy: e.target.value}))}
                className={inputClassName}
              />
            </Field>
          </div>
          
          <Field label="Cybozu Link">
            <input
              type="url"
              value={editForm.cybozuLink}
              onChange={(e) => setEditForm(c => ({...c, cybozuLink: e.target.value}))}
              placeholder="https://sasaki-coating.cybozu.com/..."
              className={inputClassName}
            />
          </Field>

          <FileUploadList
            label="DXF"
            accept=".dxf"
            files={editDxfFiles}
            onAdd={handleEditDxfFilesAdd}
            onRemove={handleEditDxfFileRemove}
            onRename={handleEditDxfFileRename}
            disabled={!editForm.shisakuNo.trim()}
          />
          <FileUploadList
            label="PDF"
            accept=".pdf"
            files={editPdfFiles}
            onAdd={handleEditPdfFilesAdd}
            onRemove={handleEditPdfFileRemove}
            onRename={handleEditPdfFileRename}
            disabled={!editForm.shisakuNo.trim()}
          />
          <FileUploadList
            label="PCE"
            accept=".pce"
            files={editPceFiles}
            onAdd={handleEditPceFilesAdd}
            onRemove={handleEditPceFileRemove}
            onRename={handleEditPceFileRename}
            disabled={!editForm.shisakuNo.trim()}
          />
        </div>
        
        <div className="border-t border-separator/40 bg-surface-container/30 px-6 py-4 flex items-center justify-between rounded-b-2xl">
          <button
            type="button"
            onClick={() => handleDelete(editForm)}
            className="rounded-xl border border-error/20 bg-error/5 px-4 py-2 text-xs font-semibold text-error transition-all hover:bg-error/10"
          >
            Delete 試作
          </button>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setEditFormOpen(false)}
              className="rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container-high"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditSubmit}
              disabled={editSubmitting}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              {editSubmitting
                ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>}
              {editSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </ModalShell>


      <DataTable
        columns={columns}
        rows={records}
        loading={loading}
        error={error}
        sort={sort}
        onSort={handleSort}
        page={page}
        pageSize={pageSize}
        filteredCount={filteredCount}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        pageSizeOptions={[10, 50, 100]}
        stickyHeader
        enableColumnResize
        enableColumnReorder
        layoutStorageKey="prototype-management-table"
        onRowClick={(row) => setSelectedRecord(row)}
        className="overflow-hidden cursor-pointer"
        emptyTitle="No prototypes registered"
        emptyMessage="Use “register new 試作” to add the first entry."
        rowKey={(row, rowIndex) => row?._id?.$oid || row?._id || rowIndex}
      />
    </section>
  );
}
