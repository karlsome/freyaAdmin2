import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  createMasterRecord,
  deleteMasterRecord,
  fetchEquipmentHistory,
  fetchFactoryDBRecords,
  fetchSetsubiDBRecords,
  updateMasterRecord,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";
import EquipmentEventModal from "./EquipmentEventModal";
import SetsubiRecordModal from "./SetsubiRecordModal";

// ── Shared sub-components ────────────────────────────────────────────────────

function SuccessModal({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center px-4 pb-4 pt-10">
        <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden">
          <div className="border-b border-outline-variant/20 px-6 py-5">
            <h3 className="text-2xl font-black text-on-surface">Success</h3>
          </div>
          <div className="px-6 py-6">
            <p className="text-sm text-on-surface-variant">{message}</p>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={onClose}
                className="rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90">
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageLightbox({ url, onClose }) {
  if (!url) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onClose}>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt="full size"
          className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" />
        <button type="button" onClick={onClose}
          className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white shadow-lg transition hover:bg-white/40">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
    </div>,
    document.body
  );
}

function EventCard({ event }) {
  const [lightboxURL, setLightboxURL] = useState(null);
  const images = Array.isArray(event.imageURLs) ? event.imageURLs : [];
  const tags = Array.isArray(event.tags) ? event.tags : [];

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        {event.eventDate
          ? <span className="rounded-xl bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">{event.eventDate}</span>
          : <span className="text-[11px] text-on-surface-variant/50">日付未記入</span>}
        {event["名前"] && <span className="text-[11px] text-on-surface-variant">{event["名前"]}</span>}
      </div>
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
              {tag}
            </span>
          ))}
        </div>
      )}
      <p className="whitespace-pre-wrap text-sm text-on-surface">{event["発生事案"] || "—"}</p>
      {images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((url) => (
            <button key={url} type="button" onClick={() => setLightboxURL(url)}
              className="overflow-hidden rounded-xl border border-outline-variant/20 transition hover:opacity-80">
              <img src={url} alt="添付画像" className="h-14 w-14 object-cover" />
            </button>
          ))}
        </div>
      )}
      <ImageLightbox url={lightboxURL} onClose={() => setLightboxURL(null)} />
    </div>
  );
}

// ── Right-hand detail panel (inline, not a popup) ────────────────────────────

function EquipmentDetailPanel({ equipment, onClose }) {
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    if (!equipment) return undefined;
    const equipmentId = equipment._id?.$oid ?? equipment._id;
    if (!equipmentId) return undefined;

    let active = true;
    setHistory([]);
    setHistoryError("");
    setHistoryLoading(true);

    fetchEquipmentHistory(String(equipmentId))
      .then((records) => { if (active) setHistory(Array.isArray(records) ? records : []); })
      .catch((err) => { if (active) setHistoryError(err?.message || "Failed to load history."); })
      .finally(() => { if (active) setHistoryLoading(false); });

    return () => { active = false; };
  }, [equipment]);

  if (!equipment) return null;

  return (
    <div className="rounded-3xl border border-outline-variant/25 bg-surface-container shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 px-6 py-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">設備詳細</p>
          <h3 className="mt-1 text-xl font-black text-on-surface">{equipment.name || "—"}</h3>
          {equipment["工場"] && (
            <p className="mt-0.5 text-sm text-on-surface-variant">{equipment["工場"]}</p>
          )}
        </div>
        <button type="button" onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>

      <div className="overflow-y-auto px-6 py-6" style={{ maxHeight: "calc(100vh - 220px)" }}>
        {/* Image */}
        {equipment.imageURL && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface">
            <img
              src={equipment.imageURL}
              alt={equipment.name || "equipment"}
              className="h-44 w-full object-contain p-3"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>
        )}

        {/* Equipment details */}
        <section className="mb-6">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-outline">設備情報</p>
          <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-outline-variant/20 bg-surface px-5 py-4">
            {[
              { label: "設備名", value: equipment.name },
              { label: "工場",   value: equipment["工場"] },
              { label: "設置日", value: equipment.installationDate },
            ].map(({ label, value }) =>
              value ? (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">{label}</dt>
                  <dd className="text-sm text-on-surface">{value}</dd>
                </div>
              ) : null
            )}
          </dl>
        </section>

        {/* Event history */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">事案履歴</p>
            {!historyLoading && (
              <span className="text-[11px] text-on-surface-variant">{history.length} 件</span>
            )}
          </div>

          {historyLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
              読み込み中…
            </div>
          )}
          {!historyLoading && historyError && (
            <div className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">{historyError}</div>
          )}
          {!historyLoading && !historyError && history.length === 0 && (
            <div className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-6 text-center text-sm italic text-on-surface-variant">
              事案の記録はまだありません。
            </div>
          )}
          {!historyLoading && !historyError && history.length > 0 && (
            <div className="flex flex-col gap-3">
              {history.map((event, i) => (
                <EventCard key={event._id?.$oid ?? event._id ?? i} event={event} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyDetailPanel() {
  return (
    <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-outline-variant/30 bg-surface-container/50">
      <div className="text-center">
        <span className="material-symbols-outlined text-outline/40" style={{ fontSize: 40 }}>
          precision_manufacturing
        </span>
        <p className="mt-3 text-sm font-medium text-on-surface-variant/50">
          Select a machine to view details
        </p>
      </div>
    </div>
  );
}

// ── Factory-box sub-components ───────────────────────────────────────────────

function EquipmentRow({ equipment, isSelected, canEdit, onView, onEdit }) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition ${
      isSelected
        ? "border-primary/40 bg-primary/5"
        : "border-outline-variant/15 bg-surface"
    }`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-on-surface">{equipment.name || "—"}</p>
        {equipment.installationDate && (
          <p className="mt-0.5 text-[10px] text-on-surface-variant">設置日: {equipment.installationDate}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={() => onView(equipment)}
          className={`inline-flex items-center justify-center gap-0.5 rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
            isSelected
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high"
          }`}>
          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>info</span>
          View
        </button>
        {canEdit && (
          <button type="button" onClick={() => onEdit(equipment)}
            className="inline-flex items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container px-2 py-1 text-[10px] font-bold text-on-surface transition hover:bg-surface-container-high">
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

function FactoryBox({ factory, equipment, selectedId, canEdit, onAddEvent, onView, onEdit }) {
  const name = factory["工場"] || "—";
  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>factory</span>
          </div>
          <h4 className="text-sm font-black text-on-surface">{name}</h4>
        </div>
        {canEdit && (
          <button type="button" onClick={() => onAddEvent(factory)}
            className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1.5 text-[10px] font-bold text-primary transition hover:bg-primary/20">
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>add</span>
            事案を追加
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {equipment.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/20 bg-surface px-3 py-2 text-center">
            <p className="text-[10px] italic text-on-surface-variant/50">No equipment recorded yet.</p>
          </div>
        ) : (
          equipment.map((eq) => {
            const id = eq._id?.$oid ?? eq._id ?? eq.name;
            return (
              <EquipmentRow key={id} equipment={eq}
                isSelected={(eq._id?.$oid ?? eq._id) === selectedId}
                canEdit={canEdit} onView={onView} onEdit={onEdit} />
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main workspace ───────────────────────────────────────────────────────────

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

  // Inline detail panel
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
        imageURL: draft.imageURL || undefined,
      };
      const username = authUser?.username || "unknown";
      if (editingRecord) {
        const recordId = editingRecord._id?.$oid ?? editingRecord._id;
        await updateMasterRecord({ recordId, updates: payload, username, tabKey: "setsubiDB" });
        setSuccessMessage("Record edited successfully.");
        if (viewingEquipment && (viewingEquipment._id?.$oid ?? viewingEquipment._id) === recordId) {
          setViewingEquipment({ ...viewingEquipment, ...payload });
        }
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
      if (viewingEquipment && (viewingEquipment._id?.$oid ?? viewingEquipment._id) === recordId) {
        setViewingEquipment(null);
      }
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
        tags: draft.tags?.length ? draft.tags : undefined,
        imageURLs: draft.imageURLs?.length ? draft.imageURLs : undefined,
      };
      await createMasterRecord({ data: payload, username: authUser?.username || "unknown", tabKey: "equipmentHistoryDB" });
      setSuccessMessage("事案を登録しました。");
      closeEventModal();
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || "Failed to save event record." });
    } finally {
      setEventSubmitting(false);
    }
  }

  const eventModalEquipment = useMemo(() => {
    if (!eventModalFactory) return [];
    return equipmentByFactory.get(eventModalFactory["工場"] || "") ?? [];
  }, [eventModalFactory, equipmentByFactory]);

  const selectedId = viewingEquipment ? (viewingEquipment._id?.$oid ?? viewingEquipment._id) : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section className="glass-card rounded-3xl p-6">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">設備</p>
          <h3 className="mt-1 text-2xl font-black text-on-surface">Equipment by Factory</h3>
        </div>
        <div className="flex items-center gap-4">
          {!loading && !error && (
            <span className="text-sm text-on-surface-variant">
              {equipment.length} items · {factories.length} factories
            </span>
          )}
          {canEdit && (
            <button type="button" onClick={() => openCreateEquipModal()}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition hover:opacity-90">
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

      {/* ── Two-panel layout ── */}
      {!loading && !error && factories.length > 0 && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* LEFT: 2-column factory grid */}
          <div className="lg:w-[42%] lg:shrink-0">
            <div className="grid grid-cols-2 gap-4">
              {factories.map((factory, index) => {
                const key = factory._id?.$oid ?? factory._id ?? String(index);
                const factoryName = factory["工場"] || "";
                const factoryEquipment = equipmentByFactory.get(factoryName) ?? [];
                return (
                  <FactoryBox
                    key={key}
                    factory={factory}
                    equipment={factoryEquipment}
                    selectedId={selectedId}
                    canEdit={canEdit}
                    onAddEvent={openEventModal}
                    onView={setViewingEquipment}
                    onEdit={openEditEquipModal}
                  />
                );
              })}
            </div>
          </div>

          {/* RIGHT: inline detail panel */}
          <div className="flex-1 min-w-0 lg:sticky lg:top-6">
            {viewingEquipment
              ? <EquipmentDetailPanel equipment={viewingEquipment} onClose={() => setViewingEquipment(null)} />
              : <EmptyDetailPanel />}
          </div>
        </div>
      )}

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

      <EquipmentEventModal
        open={eventModalOpen}
        factoryEquipment={eventModalEquipment}
        submitting={eventSubmitting}
        username={authUser?.username || "unknown"}
        onClose={closeEventModal}
        onSubmit={handleSaveEvent}
      />

      <SuccessModal message={successMessage} onClose={() => setSuccessMessage("")} />
    </section>
  );
}
