import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import ModalShell from "../components/ModalShell";
import TagInput from "../components/TagInput";
import { deleteShisaku, fetchShisakuList, registerShisaku, updateShisaku, fetchShisakuRequestGroupedList } from "../services/api";
import { convertPdfFileToPreviewImage } from "../utils/productPDFs";
import { getAuthUser } from "../utils/masterDB";
import { useLanguage } from "../contexts/LanguageContext";

const EMPTY_FORM = {
  shisakuNo: "",
  deadline: "",
  eventName: "",
  modelName: "",
  customerName: "",
  registeredBy: "",
  cybozuLink: "",
  colors: [],
  materials: [],
  boxTypes: [],
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
    ? "bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/20"
    : flash.type === "success"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

  return (
    <div className={`mb-6 rounded-[8px] border px-4 py-3 ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.04em]">Status</div>
          <p className="mt-0.5 text-xs font-medium">{flash.message}</p>
        </div>
        <button type="button" onClick={onClose} className="text-current/70 transition hover:text-current">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

const inputClassName = "rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--freya-blue)] focus:outline-none transition-colors";

function FileUploadList({ label, accept, files, onAdd, onRemove, onRename, disabled }) {
  return (
    <div className="flex flex-col gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</span>
        <label className={`inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] shadow-2xs ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
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
        <p className="text-[11px] text-[var(--text-muted)]">{disabled ? "Enter 試作番号 first" : "No files selected"}</p>
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
                className="flex-shrink-0 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--text-muted)] transition hover:border-[var(--status-danger)]/30 hover:bg-[var(--status-danger)]/10 hover:text-[var(--status-danger)] shadow-2xs"
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
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
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
        const [data, groupedData] = await Promise.all([
          fetchShisakuList({
            page,
            limit: pageSize,
            sortColumn: sort.column,
            sortDirection: sort.direction,
          }),
          fetchShisakuRequestGroupedList({ limit: 1000 })
        ]);
        if (cancelled) return;

        const requestCounts = new Map(
          (groupedData?.rows || []).map((row) => [
            String(row.shisakudb_id || row.shisakuNo),
            row.totalRequests || 0
          ])
        );

        const rows = (data?.rows || []).map(row => {
          const id = row._id?.$oid || row._id;
          const count = requestCounts.get(String(id)) || requestCounts.get(String(row.shisakuNo)) || 0;
          return { ...row, totalRequests: count };
        });

        setRecords(rows);
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
          name: buildFileName(form.shisakuNo, file.name) || file.name,
          touched: false,
        })),
      ]);
    };
  }

  function createEditFilesAddHandler(setter) {
    return (files) => {
      if (!files?.length) return;
      setter((current) => [
        ...current,
        ...files.map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          name: buildFileName(editForm.shisakuNo, file.name) || file.name,
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
        createdBy: getAuthUser()?.username || "",
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
      colors: record.colors || [],
      materials: record.materials || [],
      boxTypes: record.boxTypes || [],
      status: record.status || "pending",
      _id: record._id,
    });
    setEditDxfFiles((record.dxfLinks || (record.dxflink ? [{name: 'DXF', link: record.dxflink}] : [])).map(l => ({ id: Math.random().toString(), name: l.name, link: l.link })));
    setEditPdfFiles((record.pdfLinks || (record.pdflink ? [{name: 'PDF', link: record.pdflink}] : [])).map(l => ({ id: Math.random().toString(), name: l.name, link: l.link })));
    setEditPceFiles((record.pcelinks || (record.pcelink ? [{name: 'PCE', link: record.pcelink}] : [])).map(l => ({ id: Math.random().toString(), name: l.name, link: l.link })));
    
    setSelectedRecord(null);
    setEditFormOpen(true);
  }

  const handleEditDxfFilesAdd = createEditFilesAddHandler(setEditDxfFiles);
  const handleEditDxfFileRemove = createFileRemoveHandler(setEditDxfFiles);
  const handleEditDxfFileRename = createFileRenameHandler(setEditDxfFiles);

  const handleEditPdfFilesAdd = createEditFilesAddHandler(setEditPdfFiles);
  const handleEditPdfFileRemove = createFileRemoveHandler(setEditPdfFiles);
  const handleEditPdfFileRename = createFileRenameHandler(setEditPdfFiles);

  const handleEditPceFilesAdd = createEditFilesAddHandler(setEditPceFiles);
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
        if (f.link) return { name: f.name, link: f.link }; 
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
        colors: editForm.colors || [],
        materials: editForm.materials || [],
        boxTypes: editForm.boxTypes || [],
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
    { key: "shisakuNo", label: t("prototypeNo"), width: 120, renderCell: (r) => <span className="font-mono">{r.shisakuNo || "—"}</span> },
    { key: "deadline", label: t("deadline"), width: 130, renderCell: (r) => <span className="font-mono">{r.deadline || "—"}</span> },
    { key: "eventName", label: t("eventName"), width: 160, renderCell: (r) => r.eventName || "—" },
    { key: "modelName", label: t("modelName"), width: 160, renderCell: (r) => <span className="font-mono font-medium">{r.modelName || "—"}</span> },
    { key: "customerName", label: t("customerName"), width: 160, renderCell: (r) => r.customerName || "—" },
    {
      key: "status",
      label: t("status"),
      width: 120,
      renderCell: (r) => {
        const status = r.status || "pending";
        let colorClass = "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
        if (status === "completed") colorClass = "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
        if (status === "in-progress") colorClass = "border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]";
        return (
          <span className={`inline-flex items-center justify-center rounded-[4px] border px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider ${colorClass}`}>
            {status}
          </span>
        );
      },
    },
    { key: "totalRequests", label: t("totalRequests"), sortable: true, width: 150, align: "center", renderCell: (r) => <span className="font-mono">{r.totalRequests ?? 0}</span> },
    {
      key: "cybozuLink",
      label: t("cybozuLink"),
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
              className="inline-flex items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--text-secondary)] hover:text-[var(--freya-blue)] hover:border-[var(--freya-blue)]/30 transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>open_in_new</span>
            </a>
          </div>
        ) : "—"
      ),
    },
    { key: "createdBy", label: t("createdBy"), width: 120, renderCell: (r) => r.createdBy || "—" },
    {
      key: "createdAt",
      label: t("timestamp"),
      sortable: true,
      width: 150,
      renderCell: (r) => {
        const d = r.createdAt ? new Date(r.createdAt.$date || r.createdAt) : null;
        return d ? <span className="font-mono text-xs">{d.toLocaleString()}</span> : "—";
      },
    },

  ], [deletingId, t]);

  return (
    <div className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      <PageHeader
        title={t("prototypeManagement")}
        subtitle="Register new 試作 entries and manage their DXF, PDF, and PCE files."
        actions={(
          <button
            type="button"
            onClick={() => {
              setFormOpen(true);
              resetForm();
            }}
            className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>
            {t("registerPrototype")}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-outline-variant/20 pt-4 mt-2">
            <TagInput
              label="Colors"
              tags={form.colors || []}
              setTags={(tags) => handleFieldChange("colors", tags)}
            />
            <TagInput
              label="Materials"
              tags={form.materials || []}
              setTags={(tags) => handleFieldChange("materials", tags)}
            />
            <TagInput
              label="Box Types"
              tags={form.boxTypes || []}
              setTags={(tags) => handleFieldChange("boxTypes", tags)}
            />
          </div>

          {!shisakuNoEntered && (
            <div className="flex items-start gap-2 rounded-[6px] border border-amber-500/20 bg-amber-500/5 px-3 py-2">
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
        
        <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-3.5 flex items-center justify-end gap-2.5 rounded-b-[12px]">
          <button
            type="button"
            onClick={() => { resetForm(); setFormOpen(false); }}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRegister}
            disabled={!canRegister}
            className="flex items-center justify-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs disabled:opacity-40"
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
          title={selectedRecord?.shisakuNo ? `試作${selectedRecord.shisakuNo}` : t("prototypeInfoAndFiles")}
          description={t("prototypeInfoAndFiles")}
          maxWidth="max-w-3xl"
      >
        {selectedRecord && (() => {
          const hasAnyFile = (selectedRecord.dxfLinks?.length > 0) || (selectedRecord.pdfLinks?.length > 0) || (selectedRecord.pcelinks?.length > 0) || selectedRecord.dxflink || selectedRecord.pdflink;
          
          return (
            <div className="px-6 py-4 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
                    {t("deadline")}
                  </h3>
                  <p className="text-xs font-mono text-[var(--text-primary)]">{selectedRecord.deadline || "—"}</p>
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
                    {t("eventName")}
                  </h3>
                  <p className="text-xs text-[var(--text-primary)]">{selectedRecord.eventName || "—"}</p>
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
                    {t("modelName")}
                  </h3>
                  <p className="text-xs font-mono font-medium text-[var(--text-primary)]">{selectedRecord.modelName || "—"}</p>
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
                    {t("customerName")}
                  </h3>
                  <p className="text-xs text-[var(--text-primary)]">{selectedRecord.customerName || "—"}</p>
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
                    {t("registeredBy")}
                  </h3>
                  <p className="text-xs text-[var(--text-primary)]">{selectedRecord.registeredBy || "—"}</p>
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
                    {t("registeredAt")}
                  </h3>
                  <p className="text-xs font-mono text-[var(--text-primary)]">
                    {selectedRecord.createdAt ? new Date(selectedRecord.createdAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
                    {t("status")}
                  </h3>
                  <div>
                    {(() => {
                      const status = selectedRecord.status || "pending";
                      let colorClass = "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
                      if (status === "completed") colorClass = "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                      if (status === "in-progress") colorClass = "border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]";
                      return (
                        <span className={`inline-flex items-center justify-center rounded-[4px] border px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider ${colorClass}`}>
                          {status}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="col-span-1 sm:col-span-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
                    {t("cybozuLink")}
                  </h3>
                  {selectedRecord.cybozuLink ? (
                    <a
                      href={selectedRecord.cybozuLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[var(--freya-blue)] font-mono transition hover:underline"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>link</span>
                      {t("openCybozuLink")}
                    </a>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">{t("noLinkProvided")}</p>
                  )}
                </div>
              </div>

              {hasAnyFile && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("files")}</h3>
                  <div className="flex flex-col gap-3">
                    {/* Legacy format rendering */}
                    {(selectedRecord.dxflink || selectedRecord.pdflink) && (
                      <div className="flex flex-wrap gap-2 items-center">
                        {[
                          ["DXF", selectedRecord.dxflink],
                          ["PDF", selectedRecord.pdflink]
                        ].map(([label, link]) => (
                          link ? (
                            <a key={label} href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-mono font-semibold text-[var(--freya-blue)] transition hover:bg-[var(--surface-hover)] shadow-2xs">
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>description</span>
                              {label}
                            </a>
                          ) : null
                        ))}
                      </div>
                    )}

                    {/* Arrays format rendering */}
                    {(selectedRecord.dxfLinks?.length > 0) && (
                      <div>
                        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{t("dxfFiles")}</div>
                        <div className="flex flex-wrap gap-2 items-center">
                          {selectedRecord.dxfLinks.map((entry, idx) => (
                            <a key={idx} href={entry.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-mono font-medium text-[var(--text-primary)] hover:border-[var(--freya-blue)]/40 hover:text-[var(--freya-blue)] transition shadow-2xs">
                              <span className="text-[10px] opacity-60 font-mono">{idx + 1}.</span>
                              {entry.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {(selectedRecord.pdfLinks?.length > 0) && (
                      <div>
                        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{t("pdfFiles")}</div>
                        <div className="flex flex-wrap gap-2 items-center">
                          {selectedRecord.pdfLinks.map((entry, idx) => (
                            <a key={idx} href={entry.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-mono font-medium text-[var(--text-primary)] hover:border-[var(--freya-blue)]/40 hover:text-[var(--freya-blue)] transition shadow-2xs">
                              <span className="text-[10px] opacity-60 font-mono">{idx + 1}.</span>
                              {entry.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedRecord.pcelinks?.length > 0 && (
                      <div>
                        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{t("pceFiles")}</div>
                        <div className="flex flex-wrap gap-2 items-center">
                          {selectedRecord.pcelinks.map((entry, idx) => (
                            <a key={idx} href={entry.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-mono font-medium text-[var(--text-primary)] hover:border-[var(--freya-blue)]/40 hover:text-[var(--freya-blue)] transition shadow-2xs">
                              <span className="text-[10px] opacity-60 font-mono">{idx + 1}.</span>
                              {entry.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {(selectedRecord.colors?.length > 0 || selectedRecord.materials?.length > 0 || selectedRecord.boxTypes?.length > 0) && (
                      <div className="mt-1 pt-3 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {selectedRecord.colors?.length > 0 && (
                          <div>
                            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{t("colors")}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedRecord.colors.map((c, i) => (
                                <span key={i} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-mono font-medium text-[var(--text-secondary)]">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedRecord.materials?.length > 0 && (
                          <div>
                            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{t("materials")}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedRecord.materials.map((c, i) => (
                                <span key={i} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-mono font-medium text-[var(--text-secondary)]">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedRecord.boxTypes?.length > 0 && (
                          <div>
                            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{t("boxTypes")}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedRecord.boxTypes.map((c, i) => (
                                <span key={i} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-mono font-medium text-[var(--text-secondary)]">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        
        <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-3.5 flex items-center justify-end gap-2.5 rounded-b-[12px]">
          <button
            type="button"
            onClick={() => setSelectedRecord(null)}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            {t("close")}
          </button>
          <button
            type="button"
            onClick={() => {
              const id = selectedRecord._id?.$oid || selectedRecord._id;
              if (id) navigate(`/prototype/request/${id}`);
            }}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            {t("addPrototypeRequest")}
          </button>
          <button
            type="button"
            onClick={() => handleOpenEditModal(selectedRecord)}
            className="flex items-center justify-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
            {t("edit")}
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
        <div className="px-6 py-4 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
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
                onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                className={inputClassName}
              />
            </Field>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Status</label>
              <select
                value={editForm.status || "pending"}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className={inputClassName}
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In-Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-[var(--border)] pt-4 mt-2">
            <TagInput
              label="Colors"
              tags={editForm.colors || []}
              setTags={(tags) => setEditForm(c => ({...c, colors: tags}))}
            />
            <TagInput
              label="Materials"
              tags={editForm.materials || []}
              setTags={(tags) => setEditForm(c => ({...c, materials: tags}))}
            />
            <TagInput
              label="Box Types"
              tags={editForm.boxTypes || []}
              setTags={(tags) => setEditForm(c => ({...c, boxTypes: tags}))}
            />
          </div>

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
        
        <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-3.5 flex items-center justify-between rounded-b-[12px]">
          <button
            type="button"
            onClick={() => handleDelete(editForm)}
            className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 transition-colors shadow-2xs"
          >
            Delete 試作
          </button>
          
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setEditFormOpen(false)}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditSubmit}
              disabled={editSubmitting}
              className="flex items-center justify-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs disabled:opacity-40"
            >
              {editSubmitting
                ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>}
              {editSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </ModalShell>

      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
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
          pageSizeOptions={[30, 50, 100]}
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
      </div>
    </div>
  );
}
