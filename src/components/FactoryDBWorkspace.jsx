import { useEffect, useMemo, useState } from "react";
import DataTable from "./DataTable";
import FactoryRecordModal from "./FactoryRecordModal";
import {
  createMasterRecord,
  deleteMasterRecord,
  fetchFactoryDBRecords,
  updateMasterRecord,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";

function formatCoordinates(coordinates) {
  if (!coordinates || typeof coordinates !== "object") return "—";
  const lat = coordinates.lat;
  const lon = coordinates.lon;
  if (lat == null || lon == null) return "—";
  return `${lat}, ${lon}`;
}

function getSortableValue(value) {
  if (value == null) return "";
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function FactoryDBWorkspace({ refreshToken, onFlash }) {
  const authUser = getAuthUser();
  const canEdit = authUser?.role === "admin";
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ column: "工場", direction: 1 });
  const [localRefresh, setLocalRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFactories() {
      setLoading(true);
      setError("");
      try {
        const factoryRecords = await fetchFactoryDBRecords();
        if (!active) return;
        setRecords(Array.isArray(factoryRecords) ? factoryRecords : []);
      } catch (err) {
        if (!active) return;
        const message = err?.message || "Failed to load factory records.";
        setError(message);
        onFlash?.({ type: "error", message });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadFactories();
    return () => {
      active = false;
    };
  }, [refreshToken, localRefresh, onFlash]);

  const sortedRecords = useMemo(() => {
    const { column, direction } = sort;
    if (!column) return records;

    const factor = direction === -1 ? -1 : 1;
    return [...records].sort((left, right) => {
      const leftValue = getSortableValue(left?.[column]);
      const rightValue = getSortableValue(right?.[column]);

      if (leftValue === rightValue) return 0;
      if (leftValue === "") return 1 * factor;
      if (rightValue === "") return -1 * factor;

      const leftNumber = parseFloat(leftValue);
      const rightNumber = parseFloat(rightValue);
      if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
        return factor * Math.sign(leftNumber - rightNumber);
      }

      return factor * String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
    });
  }, [records, sort]);

  function handleSort(column) {
    setSort((current) => (
      current.column === column
        ? { column, direction: current.direction * -1 }
        : { column, direction: 1 }
    ));
  }

  function openCreateModal() {
    if (!canEdit) return;
    setEditingRecord(null);
    setModalOpen(true);
  }

  function openEditModal(record) {
    if (!canEdit) return;
    setEditingRecord(record);
    setModalOpen(true);
  }

  function closeFormModal() {
    setModalOpen(false);
    setEditingRecord(null);
  }

  async function handleSaveFactory(draft) {
    setFormSubmitting(true);

    try {
      const payload = {
        工場: draft["工場"] || undefined,
        location: draft.location || undefined,
        geotag: draft.geotag || undefined,
        phone: draft.phone || undefined,
        coordinates: draft.latitude || draft.longitude ? {
          lat: draft.latitude || "",
          lon: draft.longitude || "",
        } : undefined,
      };

      const authUserName = authUser?.username || "unknown";

      if (editingRecord) {
        const recordId = editingRecord._id?.$oid || editingRecord._id;
        await updateMasterRecord({ recordId, updates: payload, username: authUserName, role: authUser?.role, tabKey: "factoryDB" });
        setSuccessMessage("Record edited successfully.");
        setSuccessModalOpen(true);
      } else {
        await createMasterRecord({ data: payload, username: authUserName, role: authUser?.role, tabKey: "factoryDB" });
        setSuccessMessage("Record created successfully.");
        setSuccessModalOpen(true);
      }

      closeFormModal();
      setLocalRefresh((current) => current + 1);
    } catch (saveError) {
      onFlash?.({ type: "error", message: saveError.message || "Failed to save factory record." });
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDeleteFactory(record) {
    if (!canEdit) return;
    if (!record) return;
    const recordId = record._id?.$oid || record._id;
    if (!recordId) {
      onFlash?.({ type: "error", message: "Cannot delete a record without an ID." });
      return;
    }

    if (!window.confirm(`Delete factory record ${record["工場"] || recordId}? This cannot be undone.`)) {
      return;
    }

    setDeleteBusyId(recordId);
    try {
      await deleteMasterRecord({ recordId, username: authUser?.username || "unknown", role: authUser?.role, tabKey: "factoryDB" });
      setSuccessMessage("Record deleted successfully.");
      setSuccessModalOpen(true);
      setLocalRefresh((current) => current + 1);
    } catch (deleteError) {
      onFlash?.({ type: "error", message: deleteError.message || "Failed to delete factory record." });
    } finally {
      setDeleteBusyId(null);
    }
  }

  const columns = [
    {
      key: "工場",
      label: "工場",
      sortable: true,
      width: 200,
      renderCell: (record) => record["工場"] || "—",
    },
    {
      key: "location",
      label: "Location",
      sortable: true,
      width: 320,
      renderCell: (record) => record.location || "—",
    },
    {
      key: "geotag",
      label: "Geo Tag",
      sortable: true,
      width: 240,
      renderCell: (record) => record.geotag || "—",
    },
    {
      key: "coordinates",
      label: "Coordinates",
      sortable: true,
      width: 220,
      renderCell: (record) => formatCoordinates(record.coordinates),
    },
    {
      key: "phone",
      label: "Phone",
      sortable: true,
      width: 180,
      renderCell: (record) => record.phone || "—",
    },
    {
      key: "actions",
      label: "Actions",
      width: 180,
      sortable: false,
      align: "center",
      disableCellWrapper: true,
      renderCell: (record) => {
        const recordId = record._id?.$oid || record._id;
        return (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => openEditModal(record)}
              disabled={!canEdit}
              className="inline-flex items-center justify-center rounded-2xl border border-outline-variant/30 bg-surface px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => handleDeleteFactory(record)}
              disabled={!canEdit || deleteBusyId === recordId}
              className="inline-flex items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleteBusyId === recordId ? "Deleting…" : "Delete"}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <section className="dashboard-section rounded-2xl p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">工場</p>
          <h3 className="mt-1 text-2xl font-black text-on-surface">Factory Master List</h3>
        </div>
        <div className="flex flex-col gap-3 sm:items-end sm:flex-row sm:gap-4">
          <div className="text-sm text-on-surface-variant">
            {records.length ? `${records.length} factories loaded` : "No factory records available."}
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150"
            >
              Add Factory
            </button>
          ) : null}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={sortedRecords}
        loading={loading}
        error={error}
        sort={sort}
        page={1}
        pageSize={25}
        filteredCount={sortedRecords.length}
        totalPages={1}
        onSort={handleSort}
        onPageChange={null}
        onPageSizeChange={null}
        pageSizeOptions={[]}
        enableColumnResize
        enableColumnReorder
        layoutStorageKey="freyaAdmin2.factoryDBTableLayout"
        stickyHeader
        className="overflow-hidden"
        topBarClassName="flex flex-col gap-4 border-b border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
        bottomBarClassName="flex flex-col gap-4 border-t border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
        rowKey={(row, rowIndex) => {
          if (row?._id) {
            if (typeof row._id === "string") return row._id;
            if (typeof row._id === "object") return row._id?.$oid ?? JSON.stringify(row._id);
          }
          return String(row?.["工場"] ?? rowIndex);
        }}
      />

      <FactoryRecordModal
        open={modalOpen}
        record={editingRecord}
        submitting={formSubmitting}
        onClose={closeFormModal}
        onSubmit={handleSaveFactory}
      />

      {successModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="dashboard-section w-full max-w-md rounded-2xl overflow-hidden">
              <div className="border-b border-separator/35 px-6 py-5">
                <h3 className="text-2xl font-black text-on-surface">Success</h3>
              </div>
              <div className="px-6 py-6">
                <p className="text-sm text-on-surface-variant">{successMessage}</p>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setSuccessModalOpen(false)}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
