import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import ModalShell from "../components/ModalShell";
import { getAuthUser } from "../utils/masterDB";
import {
  BASE_URL,
  deleteShisakuRequest,
  fetchShisaku,
  fetchShisakuRequestList,
  registerShisakuRequest,
  updateShisakuRequest,
} from "../services/api";

const EMPTY_ENTRY = {
  name: "",
  okuriPitch: "",
  color: "",
  material: "",
  boxType: "",
  quantity: "",
  dxfIndex: "",
  pdfIndex: "",
  pceIndex: "",
};

const ENTRY_FIELD_KEYS = ["name", "okuriPitch", "color", "material", "boxType", "quantity"];

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

function SuggestInput({ type = "text", value, options, onChange, className }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filteredOptions = useMemo(() => {
    const query = String(value ?? "").trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, value]);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        className={`w-full ${className}`}
      />
      {open && filteredOptions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-xl border border-outline-variant/30 bg-surface py-1 shadow-lg">
          {filteredOptions.map((option) => (
            <li key={option}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange({ target: { value: option } });
                  setOpen(false);
                }}
                className="block w-full truncate px-3 py-1.5 text-left text-sm text-on-surface transition hover:bg-surface-container-high"
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inputClassName = "rounded-xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none";

export default function PrototypeRequestPage() {
  const { shisakuId } = useParams();
  const navigate = useNavigate();
  
  const [shisakuRecord, setShisakuRecord] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [entries, setEntries] = useState([{ ...EMPTY_ENTRY }]);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [detailModalRecord, setDetailModalRecord] = useState(null);
  
  const [editModalRecord, setEditModalRecord] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editShisakuRecord, setEditShisakuRecord] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadEditShisaku() {
      if (!editModalRecord) {
        setEditShisakuRecord(null);
        return;
      }
      const parentId = editModalRecord.shisakudb_id?.$oid || editModalRecord.shisakudb_id;
      if (!parentId) return;
      try {
        const data = await fetchShisaku(parentId);
        if (!cancelled) setEditShisakuRecord(data);
      } catch (e) {
        console.error("Failed to load parent prototype for edit modal", e);
      }
    }
    loadEditShisaku();
    return () => { cancelled = true; };
  }, [editModalRecord]);

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
        if (shisakuId) {
          const shisakuData = await fetchShisaku(shisakuId);
          if (cancelled) return;
          
          if (!shisakuData) {
            setError("Prototype record not found.");
            setLoading(false);
            return;
          }
          setShisakuRecord(shisakuData);
        } else {
          setShisakuRecord(null);
        }

        const requestData = await fetchShisakuRequestList(shisakuId ? { shisakudb_id: shisakuId } : {});
        if (cancelled) return;
        setRecords(Array.isArray(requestData) ? requestData : []);
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading prototype requests:", err);
        setError(err.message || "Failed to load prototype request data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [refreshNonce, shisakuId]);

  function handleEntryChange(index, key, value) {
    setEntries((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function addEntryRow() {
    setEntries((current) => [...current, { ...EMPTY_ENTRY }]);
  }

  function removeEntryRow(index) {
    setEntries((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  }

  function resetEntry() {
    setEntries([{ ...EMPTY_ENTRY }]);
  }

  const fieldSuggestions = useMemo(() => {
    const result = {};
    for (const key of ENTRY_FIELD_KEYS) {
      const values = new Set();
      for (const item of entries) {
        const value = String(item[key] ?? "").trim();
        if (value) values.add(value);
      }
      result[key] = Array.from(values);
    }
    return result;
  }, [entries]);

  const canRegister = (
    entries.every((item) =>
      item.name.trim() &&
      item.okuriPitch !== "" &&
      item.color.trim() &&
      item.material.trim() &&
      item.boxType.trim() &&
      item.quantity !== "" &&
      item.pceIndex !== ""
    ) &&
    !submitting && shisakuRecord
  );

  async function handleRegister() {
    if (!canRegister) return;
    setSubmitting(true);

    try {
      await Promise.all(entries.map((item) => {
        const dxf = item.dxfIndex !== "" ? shisakuRecord.dxfLinks[item.dxfIndex] : null;
        const pdfData = item.pdfIndex !== "" ? shisakuRecord.pdfLinks[item.pdfIndex] : null;
        const pdf = pdfData 
          ? {
              ...pdfData,
              jpgLink: pdfData.jpgLink || (shisakuRecord.pdfJpgLinks?.[item.pdfIndex]?.link || null)
            }
          : null;
        const pce = item.pceIndex !== "" ? shisakuRecord.pcelinks[item.pceIndex] : null;
        
        return registerShisakuRequest({
          name: item.name.trim(),
          dxf,
          pdf,
          pce,
          okuriPitch: Number(item.okuriPitch),
          color: item.color.trim(),
          material: item.material.trim(),
          boxType: item.boxType.trim(),
          quantity: Number(item.quantity),
          shisakudb_id: shisakuId,
          createdBy: getAuthUser()?.username || "",
        });
      }));

      setFlash({
        type: "success",
        message: entries.length > 1
          ? `${entries.length} prototype requests registered successfully.`
          : "Prototype request registered successfully.",
      });
      resetEntry();
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

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSubmitting(true);
    try {
      const id = editModalRecord?._id?.$oid || editModalRecord?._id;
      
      const dxf = editModalRecord.dxfIndex !== "" && editShisakuRecord ? editShisakuRecord.dxfLinks[editModalRecord.dxfIndex] : (editModalRecord.dxf || null);
      const pdfData = editModalRecord.pdfIndex !== "" && editShisakuRecord ? editShisakuRecord.pdfLinks[editModalRecord.pdfIndex] : (editModalRecord.pdf || null);
      const pdf = pdfData && editModalRecord.pdfIndex !== "" && editShisakuRecord
        ? {
            ...pdfData,
            jpgLink: pdfData.jpgLink || (editShisakuRecord.pdfJpgLinks?.[editModalRecord.pdfIndex]?.link || null)
          }
        : pdfData;
      const pce = editModalRecord.pceIndex !== "" && editShisakuRecord ? editShisakuRecord.pcelinks[editModalRecord.pceIndex] : (editModalRecord.pce || null);
      
      await updateShisakuRequest(id, {
        name: editModalRecord.name.trim(),
        dxf,
        pdf,
        pce,
        okuriPitch: Number(editModalRecord.okuriPitch),
        color: editModalRecord.color.trim(),
        material: editModalRecord.material.trim(),
        boxType: editModalRecord.boxType.trim(),
        quantity: Number(editModalRecord.quantity),
        status: editModalRecord.status || "pending",
      });

      setFlash({ type: "success", message: "Prototype request updated successfully." });
      setEditModalRecord(null);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setFlash({ type: "error", message: err.message || "Failed to update record." });
    } finally {
      setEditSubmitting(false);
    }
  }

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const lowerQuery = searchQuery.toLowerCase();
    return records.filter(r => 
      (r.name || "").toLowerCase().includes(lowerQuery) ||
      (r.shisakuNo || "").toLowerCase().includes(lowerQuery) ||
      (r.color || "").toLowerCase().includes(lowerQuery) ||
      (r.material || "").toLowerCase().includes(lowerQuery) ||
      (r.boxType || "").toLowerCase().includes(lowerQuery) ||
      (r.createdBy || "").toLowerCase().includes(lowerQuery)
    );
  }, [records, searchQuery]);

  const groupedPrototypes = useMemo(() => {
    if (shisakuId) return [];
    const groups = {};
    for (const r of records) {
      const idStr = r.shisakudb_id?.$oid || r.shisakudb_id;
      if (!idStr) continue;
      if (!groups[idStr]) {
        groups[idStr] = {
          shisakudb_id: idStr,
          shisakuNo: r.shisakuNo || "Unknown",
          totalRequests: 0,
          latestDate: null,
        };
      }
      groups[idStr].totalRequests += 1;
      const d = r.createdAt ? new Date(r.createdAt.$date || r.createdAt) : null;
      if (d && (!groups[idStr].latestDate || d > groups[idStr].latestDate)) {
        groups[idStr].latestDate = d;
      }
    }
    
    const arr = Object.values(groups);
    if (!searchQuery.trim()) return arr;
    const lowerQuery = searchQuery.toLowerCase();
    return arr.filter(g => 
      (g.shisakuNo || "").toLowerCase().includes(lowerQuery)
    );
  }, [records, searchQuery, shisakuId]);

  const groupedColumns = useMemo(() => [
    { key: "shisakuNo", label: "Prototype No.", sortable: true, width: 200, renderCell: (r) => `試作${r.shisakuNo}` },
    { key: "totalRequests", label: "Total Requests", sortable: true, width: 150, align: "center" },
    { 
      key: "latestDate", 
      label: "Latest Request", 
      sortable: true, 
      width: 200,
      renderCell: (r) => r.latestDate ? r.latestDate.toLocaleString() : "—"
    },
  ], []);

  const columns = useMemo(() => [
    { key: "shisakuNo", label: "Prototype No.", sortable: true, width: 120, renderCell: (r) => r.shisakuNo || "—" },
    { key: "name", label: "Name", sortable: false, width: 140, renderCell: (r) => r.name || "—" },
    { key: "okuriPitch", label: "Okuri Pitch", sortable: false, width: 110, align: "center", renderCell: (r) => r.okuriPitch ?? "—" },
    { key: "color", label: "Color", sortable: false, width: 120, renderCell: (r) => r.color || "—" },
    { key: "material", label: "Material", sortable: false, width: 120, renderCell: (r) => r.material || "—" },
    { key: "boxType", label: "Box Type", sortable: false, width: 120, renderCell: (r) => r.boxType || "—" },
    { key: "quantity", label: "Quantity", sortable: false, width: 100, align: "center", renderCell: (r) => r.quantity ?? "—" },
    {
      key: "dxf",
      label: "DXF",
      sortable: false,
      width: 100,
      align: "center",
      disableCellWrapper: true,
      renderCell: (r) => (
        r.dxf && r.dxf.link ? (
          <a href={r.dxf.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg border border-outline-variant/30 bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase text-primary transition hover:bg-surface-container-high">DXF</a>
        ) : (
          <span className="inline-flex items-center justify-center rounded-lg border border-outline-variant/15 bg-surface-container px-2.5 py-1 text-[11px] font-semibold uppercase text-on-surface-variant/40">—</span>
        )
      ),
    },
    {
      key: "pdf",
      label: "PDF",
      sortable: false,
      width: 100,
      align: "center",
      disableCellWrapper: true,
      renderCell: (r) => (
        r.pdf && r.pdf.link ? (
          <a href={r.pdf.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg border border-outline-variant/30 bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase text-primary transition hover:bg-surface-container-high">PDF</a>
        ) : (
          <span className="inline-flex items-center justify-center rounded-lg border border-outline-variant/15 bg-surface-container px-2.5 py-1 text-[11px] font-semibold uppercase text-on-surface-variant/40">—</span>
        )
      ),
    },
    {
      key: "pce",
      label: "PCE",
      sortable: false,
      width: 100,
      align: "center",
      disableCellWrapper: true,
      renderCell: (r) => (
        r.pce && r.pce.link ? (
          <a href={r.pce.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg border border-outline-variant/30 bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase text-primary transition hover:bg-surface-container-high">PCE</a>
        ) : (
          <span className="inline-flex items-center justify-center rounded-lg border border-outline-variant/15 bg-surface-container px-2.5 py-1 text-[11px] font-semibold uppercase text-on-surface-variant/40">—</span>
        )
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      width: 120,
      renderCell: (r) => {
        const status = r.status || "pending";
        let colorClass = "bg-amber-500/10 text-amber-600 border-amber-500/20";
        if (status === "completed") colorClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        if (status === "in-progress") colorClass = "bg-blue-500/10 text-blue-600 border-blue-500/20";
        return (
          <span className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase ${colorClass}`}>
            {status}
          </span>
        );
      },
    },
    { key: "createdBy", label: "Created By", sortable: true, width: 120, renderCell: (r) => r.createdBy || "—" },
    {
      key: "createdAt",
      label: "Timestamp",
      sortable: true,
      width: 150,
      renderCell: (r) => {
        const d = r.createdAt ? new Date(r.createdAt.$date || r.createdAt) : null;
        return d ? d.toLocaleString() : "—";
      },
    },
  ], [deletingId]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
        <p className="text-sm font-medium text-on-surface-variant">Loading requests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
          <span className="material-symbols-outlined text-2xl">error</span>
        </div>
        <p className="text-sm font-medium text-error">{error}</p>
        <button
          onClick={() => navigate("/prototype")}
          className="rounded-xl border border-outline-variant/30 bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
        >
          Return to Prototypes
        </button>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16 px-4 md:px-8 overflow-y-auto h-screen scrollbar-hide">
      <div className="mb-8 flex items-center justify-between">
        <PageHeader
          icon="assignment"
          title={shisakuId ? `Prototype Request: ${shisakuRecord?.shisakuNo || shisakuId}` : "All Prototype Requests"}
          description={shisakuId ? "Manage manufacturing requests for this prototype." : "View all prototype manufacturing requests."}
        />
        {shisakuId && (
        <button
          onClick={() => navigate("/prototype")}
          className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </button>
        )}
      </div>

      <FlashBanner flash={flash} onClose={() => setFlash(null)} />

      <div className="flex flex-col gap-8">
        {shisakuId && shisakuRecord && (
        <section className="rounded-3xl border border-outline-variant/30 bg-surface px-6 py-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-on-surface">New Request Entries</h3>
            <button
              type="button"
              onClick={addEntryRow}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 active:scale-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Add Row
            </button>
          </div>

          <div className="overflow-x-auto pb-4">
            <div className="min-w-max border border-outline-variant/20 bg-surface rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20 bg-surface-container-lowest">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Product Name</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">DXF</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">PDF</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">PCE *</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Pitch</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Color</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Material</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Box</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Qty</th>
                    <th className="w-12 px-4 py-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {entries.map((item, index) => (
                    <tr key={index} className="transition-colors hover:bg-surface-container-lowest/50">
                      <td className="px-4 py-3 align-top">
                        <SuggestInput value={item.name} options={fieldSuggestions.name} onChange={(e) => handleEntryChange(index, "name", e.target.value)} className={inputClassName} />
                      </td>
                      <td className="px-4 py-3 align-top min-w-[150px]">
                        <select
                          value={item.dxfIndex}
                          onChange={(e) => handleEntryChange(index, "dxfIndex", e.target.value)}
                          className={inputClassName}
                        >
                          <option value="">None</option>
                          {(shisakuRecord.dxfLinks || []).map((f, i) => (
                            <option key={i} value={i}>{f.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top min-w-[150px]">
                        <select
                          value={item.pdfIndex}
                          onChange={(e) => handleEntryChange(index, "pdfIndex", e.target.value)}
                          className={inputClassName}
                        >
                          <option value="">None</option>
                          {(shisakuRecord.pdfLinks || []).map((f, i) => (
                            <option key={i} value={i}>{f.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top min-w-[150px]">
                        <select
                          value={item.pceIndex}
                          onChange={(e) => handleEntryChange(index, "pceIndex", e.target.value)}
                          className={`${inputClassName} ${item.pceIndex === "" ? "border-error/50 bg-error/5" : ""}`}
                        >
                          <option value="">Select PCE *</option>
                          {(shisakuRecord.pcelinks || []).map((f, i) => (
                            <option key={i} value={i}>{f.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top w-24">
                        <SuggestInput type="number" value={item.okuriPitch} options={fieldSuggestions.okuriPitch} onChange={(e) => handleEntryChange(index, "okuriPitch", e.target.value)} className={inputClassName} />
                      </td>
                      <td className="px-4 py-3 align-top w-28">
                        <SuggestInput value={item.color} options={fieldSuggestions.color} onChange={(e) => handleEntryChange(index, "color", e.target.value)} className={inputClassName} />
                      </td>
                      <td className="px-4 py-3 align-top w-32">
                        <SuggestInput value={item.material} options={fieldSuggestions.material} onChange={(e) => handleEntryChange(index, "material", e.target.value)} className={inputClassName} />
                      </td>
                      <td className="px-4 py-3 align-top w-32">
                        <SuggestInput value={item.boxType} options={fieldSuggestions.boxType} onChange={(e) => handleEntryChange(index, "boxType", e.target.value)} className={inputClassName} />
                      </td>
                      <td className="px-4 py-3 align-top w-24">
                        <SuggestInput type="number" value={item.quantity} options={fieldSuggestions.quantity} onChange={(e) => handleEntryChange(index, "quantity", e.target.value)} className={inputClassName} />
                      </td>
                      <td className="px-4 py-3 align-top text-center">
                        <button
                          type="button"
                          onClick={() => removeEntryRow(index)}
                          disabled={entries.length <= 1}
                          title="Remove row"
                          className="mt-1 flex-shrink-0 rounded-lg p-1.5 text-on-surface-variant transition hover:bg-error/10 hover:text-error disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3 border-t border-outline-variant/10 pt-4">
            <button
              type="button"
              onClick={resetEntry}
              disabled={submitting}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleRegister}
              disabled={!canRegister}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary/90 hover:shadow disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                  Registering...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>assignment_turned_in</span>
                  Register Request
                </>
              )}
            </button>
          </div>
        </section>
        )}

        <section>
          <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-on-surface">{shisakuId ? "Existing Requests" : "Prototypes with Requests"}</h3>
              <p className="text-xs text-on-surface-variant mt-1">{shisakuId ? "Prototype requests created for this prototype." : "Select a prototype to view its requests."}</p>
            </div>
            
            {/* Search filter */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" style={{ fontSize: 18 }}>search</span>
              <input
                type="text"
                placeholder={shisakuId ? "Search requests..." : "Search prototypes..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-64 rounded-xl border border-outline-variant/30 bg-surface py-2 pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition focus:border-primary/40 focus:outline-none"
              />
            </div>
          </div>
          {shisakuId ? (
            <DataTable
              rows={filteredRecords}
              columns={columns}
              defaultSort={{ column: "createdAt", direction: -1 }}
              onRowClick={(r) => setDetailModalRecord(r)}
            />
          ) : (
            <DataTable
              rows={groupedPrototypes}
              columns={groupedColumns}
              defaultSort={{ column: "latestDate", direction: -1 }}
              onRowClick={(r) => navigate(`/prototype/request/${r.shisakudb_id}`)}
            />
          )}
        </section>
      </div>

      {detailModalRecord && (
        <ModalShell
          open={!!detailModalRecord}
          onClose={() => setDetailModalRecord(null)}
          title={detailModalRecord?.shisakuNo ? `Prototype Request Details - 試作${detailModalRecord.shisakuNo}` : "Prototype Request Details"}
          maxWidth="max-w-xl"
        >
          <div className="px-6 py-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Prototype No.</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.shisakuNo || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Name</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.name || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Okuri Pitch</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.okuriPitch ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Color</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.color || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Material</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.material || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Box Type</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.boxType || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Quantity</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.quantity ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Registered</span>
                <p className="text-sm font-medium text-on-surface">
                  {detailModalRecord.createdAt 
                    ? new Date(detailModalRecord.createdAt.$date || detailModalRecord.createdAt).toLocaleDateString()
                    : "—"}
                  {detailModalRecord.createdBy ? ` by ${detailModalRecord.createdBy}` : ""}
                </p>
              </div>
            </div>
            
            <div className="border-t border-separator/40 pt-4 mt-2">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-3">Linked Files</span>
              <div className="flex flex-col gap-2 text-sm">
                {detailModalRecord.dxf && detailModalRecord.dxf.link ? (
                  <div>
                    <span className="font-semibold text-on-surface-variant w-12 inline-block">DXF:</span>
                    <a href={detailModalRecord.dxf.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {detailModalRecord.dxf.name || "DXF File"}
                    </a>
                  </div>
                ) : null}
                
                {detailModalRecord.pdf && detailModalRecord.pdf.link ? (
                  <div>
                    <span className="font-semibold text-on-surface-variant w-12 inline-block">PDF:</span>
                    <a href={detailModalRecord.pdf.link} target="_blank" rel="noopener noreferrer" className="text-[#FF3B30] hover:underline">
                      {detailModalRecord.pdf.name || "PDF File"}
                    </a>
                  </div>
                ) : null}

                {detailModalRecord.pdf && detailModalRecord.pdf.jpgLink ? (
                  <div>
                    <span className="font-semibold text-on-surface-variant w-12 inline-block">JPG:</span>
                    <a href={detailModalRecord.pdf.jpgLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      {detailModalRecord.pdf.name ? detailModalRecord.pdf.name.replace(/\.pdf$/i, '.jpg') : "Preview Image"}
                    </a>
                  </div>
                ) : null}
                
                {detailModalRecord.pce && detailModalRecord.pce.link ? (
                  <div>
                    <span className="font-semibold text-on-surface-variant w-12 inline-block">PCE:</span>
                    <a href={detailModalRecord.pce.link} target="_blank" rel="noopener noreferrer" className="text-[#34C759] hover:underline">
                      {detailModalRecord.pce.name || "PCE File"}
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="border-t border-separator/40 bg-surface-container/30 px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setDetailModalRecord(null)}
              className="rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-high"
            >
              Close
            </button>
            <button
              onClick={() => {
                setEditModalRecord({
                  ...detailModalRecord,
                  dxfIndex: "",
                  pdfIndex: "",
                  pceIndex: "",
                });
                setDetailModalRecord(null);
              }}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-all hover:opacity-90 active:scale-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
              Edit
            </button>
          </div>
        </ModalShell>
      )}

      {editModalRecord && (
        <ModalShell
          open={!!editModalRecord}
          onClose={() => setEditModalRecord(null)}
          title={editModalRecord?.shisakuNo ? `Edit Prototype Request - 試作${editModalRecord.shisakuNo}` : "Edit Prototype Request"}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleEditSubmit}>
            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Name</label>
                <input
                  type="text"
                  required
                  value={editModalRecord.name}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, name: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Okuri Pitch</label>
                <input
                  type="number"
                  required
                  value={editModalRecord.okuriPitch}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, okuriPitch: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Color</label>
                <input
                  type="text"
                  required
                  value={editModalRecord.color}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, color: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Material</label>
                <input
                  type="text"
                  required
                  value={editModalRecord.material}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, material: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Box Type</label>
                <input
                  type="text"
                  required
                  value={editModalRecord.boxType}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, boxType: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Quantity</label>
                <input
                  type="number"
                  required
                  value={editModalRecord.quantity}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, quantity: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Status</label>
                <select
                  value={editModalRecord.status || "pending"}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, status: e.target.value })}
                  className={inputClassName + " w-full"}
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In-Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              
              <div className="md:col-span-2 grid grid-cols-1 gap-4 border-t border-separator/40 pt-4 mt-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-on-surface-variant">DXF File</label>
                  <select
                    value={editModalRecord.dxfIndex}
                    onChange={(e) => setEditModalRecord({ ...editModalRecord, dxfIndex: e.target.value })}
                    className={inputClassName + " w-full"}
                  >
                    <option value="">Keep current ({editModalRecord.dxf ? editModalRecord.dxf.name : "None"})</option>
                    {editShisakuRecord?.dxfLinks?.map((l, i) => (
                      <option key={i} value={i}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-on-surface-variant">PDF File</label>
                  <select
                    value={editModalRecord.pdfIndex}
                    onChange={(e) => setEditModalRecord({ ...editModalRecord, pdfIndex: e.target.value })}
                    className={inputClassName + " w-full"}
                  >
                    <option value="">Keep current ({editModalRecord.pdf ? editModalRecord.pdf.name : "None"})</option>
                    {editShisakuRecord?.pdfLinks?.map((l, i) => (
                      <option key={i} value={i}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-on-surface-variant">PCE File</label>
                  <select
                    value={editModalRecord.pceIndex}
                    onChange={(e) => setEditModalRecord({ ...editModalRecord, pceIndex: e.target.value })}
                    className={inputClassName + " w-full"}
                  >
                    <option value="">Keep current ({editModalRecord.pce ? editModalRecord.pce.name : "None"})</option>
                    {editShisakuRecord?.pcelinks?.map((l, i) => (
                      <option key={i} value={i}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-separator/40 bg-surface-container/30 px-6 py-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete this record?")) {
                    setEditModalRecord(null);
                    handleDelete(editModalRecord);
                  }
                }}
                className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 px-4 py-2 text-sm font-semibold text-error transition-all hover:bg-error/10 active:scale-95"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalRecord(null)}
                  className="rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-high"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                >
                  {editSubmitting ? (
                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
