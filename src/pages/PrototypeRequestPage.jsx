import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import ModalShell from "../components/ModalShell";
import { getAuthUser } from "../utils/masterDB";
import { useLanguage } from "../contexts/LanguageContext";
import {
  BASE_URL,
  deleteShisakuRequest,
  fetchShisaku,
  fetchShisakuRequestList,
  fetchShisakuRequestGroupedList,
  fetchAvailableShisakuForRequest,
  registerShisakuRequest,
  updateShisakuRequest,
  bulkDeleteShisakuRequests,
  reorderShisakuRequests,
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
  const { t } = useLanguage();
  
  const [shisakuRecord, setShisakuRecord] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem(`freya-prototype-requests-${shisakuId || "new"}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse saved requests from local storage", e);
    }
    return [{ ...EMPTY_ENTRY }];
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [totalPages, setTotalPages] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [sort, setSort] = useState({ column: "orderNumber", direction: 1 });

  const [editMode, setEditMode] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const [detailModalRecord, setDetailModalRecord] = useState(null);
  
  const [editModalRecord, setEditModalRecord] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editShisakuRecord, setEditShisakuRecord] = useState(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [availableShisakus, setAvailableShisakus] = useState([]);
  const [selectedShisaku, setSelectedShisaku] = useState("");
  const [shisakuSearchTerm, setShisakuSearchTerm] = useState("");
  const [showShisakuSuggestions, setShowShisakuSuggestions] = useState(false);

  const filteredAvailableShisakus = useMemo(() => {
    if (!shisakuSearchTerm) return availableShisakus.slice(0, 20);
    const lower = shisakuSearchTerm.toLowerCase();
    return availableShisakus
      .filter(s => s.shisakuNo?.toLowerCase().includes(lower))
      .slice(0, 20);
  }, [availableShisakus, shisakuSearchTerm]);

  const draggedItemRef = useRef(null);
  const draggedOverItemRef = useRef(null);

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
    localStorage.setItem(`freya-prototype-requests-${shisakuId || "new"}`, JSON.stringify(entries));
  }, [entries, shisakuId]);

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

        if (shisakuId) {
          const requestData = await fetchShisakuRequestList({
            shisakudb_id: shisakuId,
            page,
            limit: pageSize,
            sortColumn: sort.column,
            sortDirection: sort.direction
          });
          if (cancelled) return;
          setRecords(requestData?.rows || []);
          setTotalPages(requestData?.pagination?.totalPages || 1);
          setFilteredCount(requestData?.pagination?.totalCount || 0);
        } else {
          const groupedData = await fetchShisakuRequestGroupedList({
            page,
            limit: pageSize,
            sortColumn: sort.column,
            sortDirection: sort.direction
          });
          if (cancelled) return;
          setRecords(groupedData?.rows || []);
          setTotalPages(groupedData?.pagination?.totalPages || 1);
          setFilteredCount(groupedData?.pagination?.totalCount || 0);
        }
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
  }, [refreshNonce, shisakuId, page, pageSize, sort]);

  function handleEntryChange(index, key, value) {
    setEntries((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function addEntryRow() {
    setEntries((current) => [...current, { ...EMPTY_ENTRY }]);
  }

  function removeEntryRow(index) {
    if (entries.length <= 1) return;
    setEntries((current) => current.filter((_, i) => i !== index));
  }

  function resetEntry() {
    setEntries([{ ...EMPTY_ENTRY }]);
    localStorage.removeItem(`freya-prototype-requests-${shisakuId || "new"}`);
  }

  const handleDragStart = (e, index) => {
    draggedItemRef.current = index;
    // Set a timeout to delay the opacity change, so the drag image doesn't look transparent
    setTimeout(() => {
      e.target.style.opacity = '0.4';
    }, 0);
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    draggedOverItemRef.current = index;
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow drop
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (draggedItemRef.current !== null && draggedOverItemRef.current !== null && draggedItemRef.current !== draggedOverItemRef.current) {
      setEntries((current) => {
        const newEntries = [...current];
        const draggedItemContent = newEntries.splice(draggedItemRef.current, 1)[0];
        newEntries.splice(draggedOverItemRef.current, 0, draggedItemContent);
        return newEntries;
      });
    }
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    draggedItemRef.current = null;
    draggedOverItemRef.current = null;
  };

  const fieldSuggestions = useMemo(() => {
    const result = {};
    for (const key of ENTRY_FIELD_KEYS) {
      const values = new Set();
      
      // Inject parent prototype tags as base suggestions
      if (key === "color" && shisakuRecord?.colors) {
        shisakuRecord.colors.forEach(c => values.add(c));
      } else if (key === "material" && shisakuRecord?.materials) {
        shisakuRecord.materials.forEach(c => values.add(c));
      } else if (key === "boxType" && shisakuRecord?.boxTypes) {
        shisakuRecord.boxTypes.forEach(c => values.add(c));
      }
      
      for (const item of entries) {
        const value = String(item[key] ?? "").trim();
        if (value) values.add(value);
      }
      result[key] = Array.from(values);
    }
    return result;
  }, [entries, shisakuRecord]);

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
      const maxOrderNumber = filteredRecords.length > 0
        ? Math.max(...filteredRecords.map((r) => r.orderNumber || 0))
        : 0;

      await Promise.all(entries.map((item, index) => {
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
          orderNumber: maxOrderNumber + index + 1,
        });
      }));

      setFlash({
        type: "success",
        message: entries.length > 1
          ? `${entries.length} prototype requests registered successfully.`
          : "Prototype request registered successfully.",
      });
      resetEntry();
      localStorage.removeItem(`freya-prototype-requests-${shisakuId || "new"}`);
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

  async function handleOpenCreateModal() {
    setCreateModalOpen(true);
    setSelectedShisaku("");
    setShisakuSearchTerm("");
    setShowShisakuSuggestions(false);
    try {
      const data = await fetchAvailableShisakuForRequest();
      setAvailableShisakus(data || []);
    } catch (e) {
      setFlash({ type: "error", message: e.message || "Failed to load available prototypes" });
    }
  }

  async function handleBulkDelete() {
    if (selectedRequestIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedRequestIds.size} requests? This cannot be undone.`)) return;

    try {
      await bulkDeleteShisakuRequests(Array.from(selectedRequestIds));
      setFlash({ type: "success", message: `${selectedRequestIds.size} requests deleted.` });
      setSelectedRequestIds(new Set());
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setFlash({ type: "error", message: err.message || "Failed to bulk delete records." });
    }
  }

  async function handleRowReorder(sourceIndex, targetIndex) {
    if (sourceIndex === targetIndex) return;
    const newRecords = [...records];
    const [moved] = newRecords.splice(sourceIndex, 1);
    newRecords.splice(targetIndex, 0, moved);

    setRecords(newRecords);

    const baseOrder = (page - 1) * pageSize;
    const updates = newRecords.map((r, i) => ({
      id: r._id?.$oid || r._id,
      orderNumber: baseOrder + i + 1,
    }));

    try {
      await reorderShisakuRequests(updates);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setFlash({ type: "error", message: err.message || "Failed to reorder requests." });
      setRefreshNonce((current) => current + 1);
    }
  }

  const filteredRecords = records;
  const groupedPrototypes = records;

  const groupedColumns = useMemo(() => [
    { key: "shisakuNo", label: t("prototypeNo"), sortable: true, width: 200, renderCell: (r) => `試作${r.shisakuNo}` },
    {
      key: "status",
      label: t("status"),
      sortable: true,
      width: 120,
      renderCell: (r) => {
        const status = r.parentStatus || "pending";
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
    { key: "totalRequests", label: t("totalRequests"), sortable: true, width: 150, align: "center" },
    { 
      key: "latestDate", 
      label: t("latestRequest"), 
      sortable: true, 
      width: 200,
      renderCell: (r) => r.latestDate ? r.latestDate.toLocaleString() : "—"
    },
  ], []);

  const columns = useMemo(() => {
    const baseCols = [
      { key: "index", label: "#", sortable: false, width: 60, align: "center", renderCell: (r, i) => r.orderNumber ?? (i + 1) },
      { key: "shisakuNo", label: t("prototypeNo"), sortable: true, width: 120, renderCell: (r) => r.shisakuNo || "—" },
      { key: "name", label: t("partName"), sortable: true, width: 140, renderCell: (r) => r.name || "—" },
      { key: "okuriPitch", label: t("okuriPitch"), sortable: true, width: 110, align: "center", renderCell: (r) => r.okuriPitch ?? "—" },
      { key: "color", label: t("color"), sortable: true, width: 120, renderCell: (r) => r.color || "—" },
      { key: "material", label: t("material"), sortable: true, width: 120, renderCell: (r) => r.material || "—" },
      { key: "boxType", label: t("boxType"), sortable: true, width: 120, renderCell: (r) => r.boxType || "—" },
      { key: "quantity", label: t("quantityReq"), sortable: true, width: 100, align: "center", renderCell: (r) => r.quantity ?? "—" },
      {
        key: "dxf",
        label: t("dxf"),
        sortable: true,
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
        label: t("pdf"),
        sortable: true,
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
        label: t("pce"),
        sortable: true,
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
        label: t("status"),
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
      { key: "createdBy", label: t("createdBy"), sortable: true, width: 120, renderCell: (r) => r.createdBy || "—" },
      {
        key: "createdAt",
        label: t("timestamp"),
        sortable: true,
        width: 150,
        renderCell: (r) => {
          const d = r.createdAt ? new Date(r.createdAt.$date || r.createdAt) : null;
          return d ? d.toLocaleString() : "—";
        },
      },
    ];

    if (editMode) {
      baseCols.unshift({
        key: "selection",
        label: (
          <input 
            type="checkbox" 
            checked={records.length > 0 && selectedRequestIds.size === records.length}
            onChange={(e) => {
              if (e.target.checked) setSelectedRequestIds(new Set(records.map(r => r._id?.$oid || r._id)));
              else setSelectedRequestIds(new Set());
            }} 
            className="cursor-pointer"
          />
        ),
        sortable: false,
        width: 40,
        align: "center",
        disableCellWrapper: true,
        renderCell: (r) => {
          const id = r._id?.$oid || r._id;
          return (
            <input 
              type="checkbox" 
              checked={selectedRequestIds.has(id)} 
              onChange={(e) => {
                const next = new Set(selectedRequestIds);
                if (e.target.checked) next.add(id);
                else next.delete(id);
                setSelectedRequestIds(next);
              }} 
              onClick={(e) => e.stopPropagation()}
              className="cursor-pointer"
            />
          );
        }
      });
    }

    return baseCols;
  }, [deletingId, editMode, selectedRequestIds, records]);

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
        <div className="flex items-center gap-3">
          {!shisakuId && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition hover:opacity-90 active:scale-95"
            >
              {t("registerRequest")}
            </button>
          )}
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
      </div>

      <FlashBanner flash={flash} onClose={() => setFlash(null)} />

      <div className="flex flex-col gap-8">
        {shisakuId && shisakuRecord && (
        <section className="rounded-3xl border border-outline-variant/30 bg-surface px-6 py-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-on-surface">New Request Entries</h3>
          </div>

          <div className="flex flex-col gap-2 pb-4">
            {entries.map((item, index) => (
              <div 
                key={index} 
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                className="request-card relative rounded-2xl border border-outline-variant/60 bg-surface-container p-3 shadow transition-shadow hover:shadow-md"
              >
                {/* Header / Remove Button */}
                <div className="mb-2 flex items-center justify-between border-b border-outline-variant/10 pb-2">
                  <h4 className="text-sm font-semibold text-on-surface flex items-center gap-1">
                    <span 
                      className="material-symbols-outlined text-on-surface-variant/40 hover:text-on-surface cursor-grab active:cursor-grabbing p-0.5 rounded transition" 
                      style={{ fontSize: 18 }}
                      onMouseEnter={(e) => { e.currentTarget.closest('.request-card').draggable = true; }}
                      onMouseLeave={(e) => { e.currentTarget.closest('.request-card').draggable = false; }}
                    >
                      drag_indicator
                    </span>
                    Request #{index + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeEntryRow(index)}
                    disabled={entries.length <= 1}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-error/10 hover:text-error disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                    title="Remove Request"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>
                
                {/* Grid Layout for Fields */}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  {/* Top Row Fields */}
                  <div className="md:col-span-1">
                    <label className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Product Name</label>
                    <SuggestInput value={item.name} options={fieldSuggestions.name} onChange={(e) => handleEntryChange(index, "name", e.target.value)} className={inputClassName + " w-full"} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">DXF</label>
                    <select
                      value={item.dxfIndex}
                      onChange={(e) => handleEntryChange(index, "dxfIndex", e.target.value)}
                      className={inputClassName + " w-full"}
                    >
                      <option value="">None</option>
                      {(shisakuRecord.dxfLinks || []).map((f, i) => (
                        <option key={i} value={i}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">PDF</label>
                    <select
                      value={item.pdfIndex}
                      onChange={(e) => handleEntryChange(index, "pdfIndex", e.target.value)}
                      className={inputClassName + " w-full"}
                    >
                      <option value="">None</option>
                      {(shisakuRecord.pdfLinks || []).map((f, i) => (
                        <option key={i} value={i}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-0.5 block text-[11px] font-semibold text-error uppercase tracking-wider flex items-center gap-1">PCE <span className="text-[10px]">*</span></label>
                    <select
                      value={item.pceIndex}
                      onChange={(e) => handleEntryChange(index, "pceIndex", e.target.value)}
                      className={inputClassName + " w-full"}
                    >
                      <option value="">Select PCE *</option>
                      {(shisakuRecord.pcelinks || []).map((f, i) => (
                        <option key={i} value={i}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Bottom Row Fields */}
                  <div className="md:col-span-4 mt-1 grid grid-cols-2 gap-2 md:grid-cols-5 border-t border-outline-variant/10 pt-2">
                    <div>
                      <label className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Pitch</label>
                      <SuggestInput type="number" value={item.okuriPitch} options={fieldSuggestions.okuriPitch} onChange={(e) => handleEntryChange(index, "okuriPitch", e.target.value)} className={inputClassName + " w-full"} />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Color</label>
                      <SuggestInput value={item.color} options={fieldSuggestions.color} onChange={(e) => handleEntryChange(index, "color", e.target.value)} className={inputClassName + " w-full"} />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Material</label>
                      <SuggestInput value={item.material} options={fieldSuggestions.material} onChange={(e) => handleEntryChange(index, "material", e.target.value)} className={inputClassName + " w-full"} />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Box Type</label>
                      <SuggestInput value={item.boxType} options={fieldSuggestions.boxType} onChange={(e) => handleEntryChange(index, "boxType", e.target.value)} className={inputClassName + " w-full"} />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Quantity</label>
                      <SuggestInput type="number" value={item.quantity} options={fieldSuggestions.quantity} onChange={(e) => handleEntryChange(index, "quantity", e.target.value)} className={inputClassName + " w-full"} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-center mt-2">
              <button
                type="button"
                onClick={addEntryRow}
                className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-6 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/10 active:scale-95"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                Add Another Request Row
              </button>
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
              <h3 className="text-sm font-semibold text-on-surface">{shisakuId ? t("prototypeRequests") : t("prototypesWithRequests")}</h3>
              <p className="text-xs text-on-surface-variant mt-1">{shisakuId ? "Prototype requests created for this prototype." : "Select a prototype to view its requests."}</p>
            </div>
            
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {shisakuId && editMode && selectedRequestIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 rounded-xl bg-error/10 px-4 py-2 text-sm font-semibold text-error transition hover:bg-error/20"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                  {t("deleteSelected")} ({selectedRequestIds.size})
                </button>
              )}
              {shisakuId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(!editMode);
                    if (editMode) setSelectedRequestIds(new Set());
                  }}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${editMode ? 'bg-primary text-on-primary shadow-sm hover:bg-primary/90' : 'bg-surface-container border border-outline-variant/30 text-on-surface hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{editMode ? 'done' : 'edit'}</span>
                  {editMode ? 'Done' : t("editList")}
                </button>
              )}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" style={{ fontSize: 18 }}>search</span>
                <input
                  type="text"
                  placeholder={shisakuId ? t("searchRequests") : t("searchPrototypes")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-64 rounded-xl border border-outline-variant/30 bg-surface py-2 pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition focus:border-primary/40 focus:outline-none"
                />
              </div>
            </div>
          </div>
          {shisakuId ? (
            <DataTable
              rows={filteredRecords}
              columns={columns}
              enableRowReorder={editMode && !searchQuery}
              onRowReorder={handleRowReorder}
              defaultSort={{ column: "orderNumber", direction: 1 }}
              sort={sort}
              onSort={setSort}
              page={page}
              pageSize={pageSize}
              filteredCount={filteredCount}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
              pageSizeOptions={[30, 50, 100]}
              onRowClick={(r) => setDetailModalRecord(r)}
              enableColumnResize
              enableColumnReorder
              layoutStorageKey="prototype-requests-table-v2"
              stickyHeader
            />
          ) : (
            <DataTable
              rows={groupedPrototypes}
              columns={groupedColumns}
              defaultSort={{ column: "latestDate", direction: -1 }}
              sort={sort}
              onSort={setSort}
              page={page}
              pageSize={pageSize}
              filteredCount={filteredCount}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
              pageSizeOptions={[30, 50, 100]}
              onRowClick={(r) => navigate(`/prototype/request/${r.shisakudb_id}`)}
              enableColumnResize
              enableColumnReorder
              layoutStorageKey="prototype-requests-grouped-table"
              stickyHeader
            />
          )}
        </section>
      </div>

      {detailModalRecord && (
        <ModalShell
          open={!!detailModalRecord}
          onClose={() => setDetailModalRecord(null)}
          title={detailModalRecord?.shisakuNo ? `${t("prototypeRequestDetails")} - 試作${detailModalRecord.shisakuNo}` : t("prototypeRequestDetails")}
          maxWidth="max-w-xl"
        >
          <div className="px-6 py-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">{t("prototypeNo")}</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.shisakuNo || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">{t("name")}</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.name || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">{t("okuriPitch")}</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.okuriPitch ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">{t("color")}</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.color || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">{t("material")}</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.material || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">{t("boxType")}</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.boxType || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">{t("quantityReq")}</span>
                <p className="text-sm font-medium text-on-surface">{detailModalRecord.quantity ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">{t("status")}</span>
                <div>
                  {(() => {
                    const status = detailModalRecord.status || "pending";
                    let colorClass = "bg-amber-500/10 text-amber-600 border-amber-500/20";
                    if (status === "completed") colorClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                    if (status === "in-progress") colorClass = "bg-blue-500/10 text-blue-600 border-blue-500/20";
                    return (
                      <span className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase ${colorClass}`}>
                        {status}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">{t("registered")}</span>
                <p className="text-sm font-medium text-on-surface">
                  {detailModalRecord.createdAt 
                    ? new Date(detailModalRecord.createdAt.$date || detailModalRecord.createdAt).toLocaleDateString()
                    : "—"}
                  {detailModalRecord.createdBy ? ` by ${detailModalRecord.createdBy}` : ""}
                </p>
              </div>
            </div>
            
            <div className="border-t border-separator/40 pt-4 mt-2">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-3">{t("linkedFiles")}</span>
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
              {t("close")}
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
              {t("edit")}
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
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">{t("name")}</label>
                <input
                  type="text"
                  required
                  value={editModalRecord.name}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, name: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">{t("okuriPitch")}</label>
                <input
                  type="number"
                  required
                  value={editModalRecord.okuriPitch}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, okuriPitch: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">{t("color")}</label>
                <input
                  type="text"
                  required
                  value={editModalRecord.color}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, color: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">{t("material")}</label>
                <input
                  type="text"
                  required
                  value={editModalRecord.material}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, material: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">{t("boxType")}</label>
                <input
                  type="text"
                  required
                  value={editModalRecord.boxType}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, boxType: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">{t("quantityReq")}</label>
                <input
                  type="number"
                  required
                  value={editModalRecord.quantity}
                  onChange={(e) => setEditModalRecord({ ...editModalRecord, quantity: e.target.value })}
                  className={inputClassName + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">{t("status")}</label>
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
                {t("delete")}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalRecord(null)}
                  className="rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-high"
                >
                  {t("cancel")}
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
                  {t("save")}
                </button>
              </div>
            </div>
          </form>
        </ModalShell>
      )}

      <ModalShell
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Select Prototype"
        maxWidth="max-w-xl"
      >
        <div className="px-6 py-5 flex flex-col gap-4 min-h-[300px]">
          <div className="relative">
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
              Choose a prototype number to create requests for
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search prototype number..."
                value={shisakuSearchTerm}
                onChange={(e) => {
                  setShisakuSearchTerm(e.target.value);
                  setSelectedShisaku("");
                  setShowShisakuSuggestions(true);
                }}
                onFocus={() => setShowShisakuSuggestions(true)}
                onBlur={() => setTimeout(() => setShowShisakuSuggestions(false), 200)}
                className="w-full rounded-xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                search
              </span>
            </div>

            {showShisakuSuggestions && availableShisakus.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-outline-variant/30 bg-surface shadow-lg">
                <ul className="max-h-60 overflow-y-auto py-1">
                  {filteredAvailableShisakus.length > 0 ? (
                    filteredAvailableShisakus.map(s => (
                      <li
                        key={s._id}
                        className="cursor-pointer px-4 py-2.5 text-sm text-on-surface hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2"
                        onClick={() => {
                          setSelectedShisaku(s._id);
                          setShisakuSearchTerm(s.shisakuNo);
                          setShowShisakuSuggestions(false);
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px] text-primary/50">
                          {selectedShisaku === s._id ? 'radio_button_checked' : 'radio_button_unchecked'}
                        </span>
                        <span className="font-medium">試作{s.shisakuNo}</span>
                      </li>
                    ))
                  ) : (
                    <li className="px-4 py-3 text-sm text-on-surface-variant italic text-center">
                      No matching prototypes found
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {availableShisakus.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
              There are no available prototypes without requests. Please register a new prototype first.
            </p>
          )}
        </div>

        <div className="border-t border-separator/40 bg-surface-container/30 px-6 py-4 flex justify-end gap-2">
          <button
            onClick={() => setCreateModalOpen(false)}
            className="rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedShisaku) {
                navigate(`/prototype/request/${selectedShisaku}`);
                setCreateModalOpen(false);
              }
            }}
            disabled={!selectedShisaku}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Proceed
          </button>
        </div>
      </ModalShell>
    </div>
  );
}
