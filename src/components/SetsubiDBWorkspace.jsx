import { useEffect, useMemo, useState } from "react";
import {
  createMasterRecord,
  deleteMasterRecord,
  fetchFactoryDBRecords,
  fetchSetsubiDBRecords,
  updateMasterRecord,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";
import EquipmentEventModal from "./EquipmentEventModal";
import EquipmentViewModal from "./EquipmentViewModal";
import SetsubiRecordModal from "./SetsubiRecordModal";

function SuccessModal({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden">
          <div className="border-b border-outline-variant/20 px-6 py-5">
            <h3 className="text-2xl font-black text-on-surface">Success</h3>
          </div>
          <div className="px-6 py-6">
            <p className="text-sm text-on-surface-variant">{message}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EquipmentRow({ equipment, canEdit, onView, onEdit }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/15 bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-on-surface">{equipment.name || "—"}</p>
        {equipment.installationDate && (
          <p className="mt-0.5 text-[11px] text-on-surface-variant">
            設置日: {equipment.installationDate}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onView(equipment)}
          className="inline-flex items-center justify-center gap-1 rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-[11px] font-bold text-on-surface transition hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>info</span>
          View
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(equipment)}
            className="inline-flex items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-[11px] font-bold text-on-surface transition hover:bg-surface-container-high"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

function FactoryBox({ factory, equipment, canEdit, onAddEvent, onView, onEdit }) {
  const name = factory["工場"] || "—";

  return (
    <div className="rounded-3xl border border-outline-variant/25 bg-surface-container p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
              factory
            </span>
          </div>
          <div>
            
            <h4 className="text-base font-black text-on-surface">{name}</h4>
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => onAddEvent(factory)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/20"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            事案を追加
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {equipment.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/20 bg-surface px-4 py-3 text-center">
            <p className="text-xs text-on-surface-variant/50 italic">No equipment recorded yet.</p>
          </div>
        ) : (
          equipment.map((eq) => {
            const id = eq._id?.$oid ?? eq._id ?? eq.name;
            return (
              <EquipmentRow
                key={id}
                equipment={eq}
                canEdit={canEdit}
                onView={onView}
                onEdit={onEdit}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default function SetsubiDBWorkspace({ refreshToken, onFlash }) {
  const authUser = getAuthUser();
  const canEdit = authUser?.role === "admin";

  const [factories, setFactories] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [localRefresh, setLocalRefresh] = useState(0);

  // Equipment create/edit modal
  const [equipModalOpen, setEquipModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [defaultFactory, setDefaultFactory] = useState("");
  const [equipSubmitting, setEquipSubmitting] = useState(false);

  // Event (事案) modal
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalFactory, setEventModalFactory] = useState(null);
  const [eventSubmitting, setEventSubmitting] = useState(false);

  // View modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingEquipment, setViewingEquipment] = useState(null);

  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [factoryRecords, equipmentRecords] = await Promise.all([
          fetchFactoryDBRecords(),
          fetchSetsubiDBRecords(),
        ]);
        if (!active) return;
        setFactories(Array.isArray(factoryRecords) ? factoryRecords : []);
        setEquipment(Array.isArray(equipmentRecords) ? equipmentRecords : []);
      } catch (err) {
        if (!active) return;
        const message = err?.message || "Failed to load data.";
        setError(message);
        onFlash?.({ type: "error", message });
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [refreshToken, localRefresh, onFlash]);

  const factoryNames = useMemo(
    () => factories.map((f) => f["工場"]).filter(Boolean),
    [factories]
  );

  const equipmentByFactory = useMemo(() => {
    const map = new Map();
    factories.forEach((f) => map.set(f["工場"] || "", []));
    equipment.forEach((eq) => {
      const key = eq["工場"] || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(eq);
    });
    return map;
  }, [factories, equipment]);

  // ── Equipment CRUD ──────────────────────────────────────────────────────────

  function openCreateEquipModal(factoryName = "") {
    setEditingRecord(null);
    setDefaultFactory(factoryName);
    setEquipModalOpen(true);
  }

  function openEditEquipModal(record) {
    setEditingRecord(record);
    setDefaultFactory("");
    setEquipModalOpen(true);
  }

  function closeEquipModal() {
    setEquipModalOpen(false);
    setEditingRecord(null);
    setDefaultFactory("");
  }

  async function handleSaveEquipment(draft) {
    setEquipSubmitting(true);
    try {
      const payload = {
        name: draft.name || undefined,
        工場: draft["工場"] || undefined,
        installationDate: draft.installationDate || undefined,
      };
      const username = authUser?.username || "unknown";

      if (editingRecord) {
        const recordId = editingRecord._id?.$oid ?? editingRecord._id;
        await updateMasterRecord({ recordId, updates: payload, username, tabKey: "setsubiDB" });
        setSuccessMessage("Record edited successfully.");
      } else {
        await createMasterRecord({ data: payload, username, tabKey: "setsubiDB" });
        setSuccessMessage("Record created successfully.");
      }

      closeEquipModal();
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || "Failed to save equipment record." });
    } finally {
      setEquipSubmitting(false);
    }
  }

  async function handleDeleteEquipment() {
    if (!editingRecord) return;
    const recordId = editingRecord._id?.$oid ?? editingRecord._id;
    if (!recordId) return;

    if (!window.confirm(`Delete "${editingRecord.name || recordId}"? This cannot be undone.`)) return;

    setEquipSubmitting(true);
    try {
      await deleteMasterRecord({ recordId, username: authUser?.username || "unknown", tabKey: "setsubiDB" });
      setSuccessMessage("Record deleted successfully.");
      closeEquipModal();
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || "Failed to delete equipment record." });
    } finally {
      setEquipSubmitting(false);
    }
  }

  // ── Event (事案) CRUD ────────────────────────────────────────────────────────

  function openEventModal(factory) {
    setEventModalFactory(factory);
    setEventModalOpen(true);
  }

  function closeEventModal() {
    setEventModalOpen(false);
    setEventModalFactory(null);
  }

  async function handleSaveEvent(draft) {
    setEventSubmitting(true);
    try {
      const payload = {
        equipmentId: draft.equipmentId || undefined,
        equipmentName: draft.equipmentName || undefined,
        工場: draft["工場"] || undefined,
        発生事案: draft["発生事案"] || undefined,
        名前: draft["名前"] || undefined,
        eventDate: draft.eventDate || undefined,
      };
      await createMasterRecord({
        data: payload,
        username: authUser?.username || "unknown",
        tabKey: "equipmentHistoryDB",
      });
      setSuccessMessage("事案を登録しました。");
      closeEventModal();
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || "Failed to save event record." });
    } finally {
      setEventSubmitting(false);
    }
  }

  // ── View ────────────────────────────────────────────────────────────────────

  function openViewModal(record) {
    setViewingEquipment(record);
    setViewModalOpen(true);
  }

  function closeViewModal() {
    setViewModalOpen(false);
    setViewingEquipment(null);
  }

  // Equipment belonging to the factory whose event modal is open
  const eventModalEquipment = useMemo(() => {
    if (!eventModalFactory) return [];
    return equipmentByFactory.get(eventModalFactory["工場"] || "") ?? [];
  }, [eventModalFactory, equipmentByFactory]);

  return (
    <section className="glass-card rounded-3xl p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">設備</p>
          <h3 className="mt-1 text-2xl font-black text-on-surface">Equipment by Factory</h3>
        </div>
        <div className="flex items-center gap-4">
          {!loading && !error && (
            <span className="text-sm text-on-surface-variant">
              {equipment.length} {equipment.length === 1 ? "item" : "items"} across {factories.length} {factories.length === 1 ? "factory" : "factories"}
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => openCreateEquipModal()}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition hover:opacity-90"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Add Equipment
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-sm font-medium text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: 18 }}>progress_activity</span>
          Loading…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl bg-error/10 px-5 py-4 text-sm font-medium text-error">{error}</div>
      )}

      {!loading && !error && factories.length === 0 && (
        <div className="rounded-2xl border border-outline-variant/20 bg-surface px-5 py-8 text-center text-sm text-on-surface-variant">
          No factory records found in factoryDB.
        </div>
      )}

      {!loading && !error && factories.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {factories.map((factory, index) => {
            const key = factory._id?.$oid ?? factory._id ?? String(index);
            const factoryName = factory["工場"] || "";
            const factoryEquipment = equipmentByFactory.get(factoryName) ?? [];
            return (
              <FactoryBox
                key={key}
                factory={factory}
                equipment={factoryEquipment}
                canEdit={canEdit}
                onAddEvent={openEventModal}
                onView={openViewModal}
                onEdit={openEditEquipModal}
              />
            );
          })}
        </div>
      )}

      {/* Equipment create/edit modal */}
      <SetsubiRecordModal
        open={equipModalOpen}
        record={editingRecord}
        submitting={equipSubmitting}
        factories={factoryNames}
        defaultFactory={defaultFactory}
        onClose={closeEquipModal}
        onSubmit={handleSaveEquipment}
        onDelete={editingRecord ? handleDeleteEquipment : undefined}
      />

      {/* Event (事案) modal */}
      <EquipmentEventModal
        open={eventModalOpen}
        factoryEquipment={eventModalEquipment}
        submitting={eventSubmitting}
        onClose={closeEventModal}
        onSubmit={handleSaveEvent}
      />

      {/* View modal */}
      <EquipmentViewModal
        open={viewModalOpen}
        equipment={viewingEquipment}
        onClose={closeViewModal}
      />

      <SuccessModal message={successMessage} onClose={() => setSuccessMessage("")} />
    </section>
  );
}
