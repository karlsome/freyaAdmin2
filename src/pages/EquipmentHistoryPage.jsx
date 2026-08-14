import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createSetsubiHistoryRecord,
  fetchFactoryDBRecords,
  fetchSetsubiDBRecords,
  fetchSetsubiHistoryRecords,
  fetchWorkerNames,
  uploadEquipmentEventImage,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";
import PageHeader from "../components/PageHeader";
import { useLanguage } from "../contexts/LanguageContext";

const inputCls =
  "w-full rounded-xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition-all duration-150 focus:border-primary/40";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function isVideoUrl(url) {
  return /\.(mp4|mov)$/i.test(url.split("?")[0]);
}

function fillTemplate(template, values) {
  return Object.entries(values).reduce(
    (str, [key, value]) => str.replace(`{${key}}`, value),
    template
  );
}

// ── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }) {
  const { t } = useLanguage();
  if (!url) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      {isVideoUrl(url) ? (
        <video
          src={url}
          controls
          autoPlay
          className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={url}
          alt={t("fullSizeImage")}
          className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
        />
      )}
    </div>,
    document.body
  );
}

// ── Add Event Modal ───────────────────────────────────────────────────────────

function AddEventModal({ factories, allEquipment, workerNames, username, submitting, onClose, onSubmit }) {
  const { t } = useLanguage();
  const [factory, setFactory] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [date, setDate] = useState("");
  const [details, setDetails] = useState("");
  const [imageURLs, setImageURLs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  const factoryEquipment = useMemo(
    () => allEquipment.filter((eq) => eq["工場"] === factory),
    [allEquipment, factory]
  );

  const selectedEquipment = factoryEquipment.find(
    (eq) => (eq._id?.$oid ?? String(eq._id)) === equipmentId
  );

  function handleFactoryChange(e) {
    setFactory(e.target.value);
    setEquipmentId("");
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";
    setUploading(true);
    setUploadError("");
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const base64 = await toBase64(file);
        const result = await uploadEquipmentEventImage({
          base64,
          factoryName: factory,
          equipmentName: selectedEquipment?.name || "",
          username,
        });
        return result.imageURL;
      })
    );
    const urls = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const failedCount = results.filter((r) => r.status === "rejected").length;
    if (urls.length) setImageURLs((prev) => [...prev, ...urls]);
    if (failedCount) {
      const raw = results.find((r) => r.status === "rejected")?.reason?.message || "";
      setUploadError(
        raw.startsWith("<")
          ? t("uploadFailedServerError")
          : raw || fillTemplate(t("filesFailedTemplate"), { count: failedCount })
      );
    }
    setUploading(false);
  }

  function removeImage(url) {
    setImageURLs((prev) => prev.filter((u) => u !== url));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!factory || !equipmentId || !date) return;
    onSubmit({
      工場: factory,
      equipmentId,
      equipmentName: selectedEquipment?.name || "",
      名前: reportedBy,
      date,
      details,
      imageURLs,
    });
  }

  const canSubmit = Boolean(factory && equipmentId && date) && !submitting && !uploading;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="dashboard-section rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 rounded-t-2xl px-6 py-5 flex items-center justify-between border-b border-separator/40 bg-surface/90 backdrop-blur-md">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("equipmentHistoryTitle")}</p>
            <h2 className="mt-1 text-xl font-semibold text-on-surface">{t("addHistoryRecord")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-all duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <form
          id="setsubi-history-add-form"
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4"
        >
          {/* Factory */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">
              {t("factory")} <span className="text-error">*</span>
            </div>
            <select value={factory} onChange={handleFactoryChange} className={inputCls} required>
              <option value="">{t("selectFactoryOption")}</option>
              {factories.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Machine */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">
              {t("machine")} <span className="text-error">*</span>
            </div>
            <select
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className={inputCls}
              disabled={!factory || factoryEquipment.length === 0}
              required
            >
              <option value="">
                {!factory
                  ? t("selectFactoryFirstOption")
                  : factoryEquipment.length === 0
                  ? t("noEquipmentFoundOption")
                  : t("selectMachineOption")}
              </option>
              {factoryEquipment.map((eq) => {
                const id = eq._id?.$oid ?? String(eq._id);
                return (
                  <option key={id} value={id}>{eq.name}</option>
                );
              })}
            </select>
          </div>

          {/* Reported By + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">
                {t("reportedBy")}
              </div>
              <select value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} className={inputCls}>
                <option value="">{t("selectNameOption")}</option>
                {workerNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">
                {t("date")} <span className="text-error">*</span>
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">
              {t("details")}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder={t("eventDetailsPlaceholder")}
              className="w-full rounded-xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition-all duration-150 focus:border-primary/40 resize-none"
            />
          </div>

          {/* Photo upload */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">
              {t("photos")}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/mp4,video/quicktime"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                  {t("uploadingFiles")}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
                  {t("attachFiles")}
                </>
              )}
            </button>
            {uploadError && (
              <p className="mt-2 text-xs text-error">{uploadError}</p>
            )}
            {imageURLs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {imageURLs.map((url) => (
                  <div key={url} className="group relative">
                    {isVideoUrl(url) ? (
                      <video
                        src={url}
                        className="h-16 w-16 rounded-xl object-cover border border-separator/40 bg-black"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={url}
                        alt={t("attachedImage")}
                        className="h-16 w-16 rounded-xl object-cover border border-separator/40"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-error text-white group-hover:flex"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-outline-variant/20 px-6 py-4 bg-surface-container-low/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container hover:text-primary hover:border-primary/30 active:scale-95 transition-all duration-150"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            form="setsubi-history-add-form"
            disabled={!canSubmit}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t("savingEllipsis") : t("addRecord")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Event Detail Modal ────────────────────────────────────────────────────────

function EventDetailModal({ event, onClose }) {
  const { t } = useLanguage();
  const [lightboxURL, setLightboxURL] = useState(null);
  const imageURLs = Array.isArray(event.imageURLs) ? event.imageURLs : [];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="dashboard-section rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 rounded-t-2xl px-6 py-5 flex items-start justify-between gap-4 border-b border-separator/40 bg-surface/90 backdrop-blur-md">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("equipmentHistoryTitle")}</p>
            <h2 className="mt-1 text-xl font-semibold text-on-surface">{event.equipmentName || "—"}</h2>
            {event["工場"] && (
              <p className="mt-1 text-sm text-on-surface-variant">{event["工場"]}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-all duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Meta badges */}
          <div className="flex flex-wrap gap-3">
            {event.date && (
              <span className="rounded-xl bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                {event.date}
              </span>
            )}
            {event["名前"] && (
              <span className="rounded-xl bg-surface-container px-3 py-1 text-[11px] font-semibold text-on-surface-variant">
                {event["名前"]}
              </span>
            )}
          </div>

          {/* Details */}
          {event.details && (
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("details")}</p>
              <p className="mt-2 text-sm text-on-surface whitespace-pre-wrap">{event.details}</p>
            </div>
          )}

          {/* Photos */}
          {imageURLs.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("photos")}</p>
              <div className="flex flex-wrap gap-2">
                {imageURLs.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setLightboxURL(url)}
                    className="overflow-hidden rounded-xl border border-separator/40 transition hover:opacity-80"
                  >
                    {isVideoUrl(url) ? (
                      <video src={url} className="h-16 w-16 object-cover bg-black" muted playsInline />
                    ) : (
                      <img src={url} alt={t("attachedImage")} className="h-16 w-16 object-cover" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-outline-variant/20 px-6 py-4 bg-surface-container-low/50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container hover:text-primary hover:border-primary/30 active:scale-95 transition-all duration-150"
          >
            {t("close")}
          </button>
        </div>
      </div>

      <Lightbox url={lightboxURL} onClose={() => setLightboxURL(null)} />
    </div>,
    document.body
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EquipmentHistoryPage() {
  const { t } = useLanguage();
  const authUser = getAuthUser();
  const username = authUser?.username || "unknown";

  const [factories, setFactories] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [workerNames, setWorkerNames] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const [filterFactory, setFilterFactory] = useState("");
  const [filterEquipmentId, setFilterEquipmentId] = useState("");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDir, setSortDir] = useState("desc");

  const [addOpen, setAddOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [viewingEvent, setViewingEvent] = useState(null);

  // Load factories, equipment, worker names
  useEffect(() => {
    let active = true;
    async function load() {
      setDataLoading(true);
      setDataError("");
      try {
        const [factoryRecords, equipmentRecords, names] = await Promise.all([
          fetchFactoryDBRecords(),
          fetchSetsubiDBRecords(),
          fetchWorkerNames(),
        ]);
        if (!active) return;
        setFactories(
          Array.isArray(factoryRecords)
            ? factoryRecords.map((f) => f["工場"]).filter(Boolean)
            : []
        );
        setAllEquipment(Array.isArray(equipmentRecords) ? equipmentRecords : []);
        setWorkerNames(Array.isArray(names) ? names : []);
      } catch (err) {
        if (active) setDataError(err?.message || t("failedToLoadData"));
      } finally {
        if (active) setDataLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  // Load history when filter changes
  useEffect(() => {
    if (!filterFactory) {
      setHistory([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");
    fetchSetsubiHistoryRecords({
      factory: filterFactory,
      equipmentId: filterEquipmentId || undefined,
    })
      .then((rows) => { if (active) setHistory(Array.isArray(rows) ? rows : []); })
      .catch((err) => { if (active) setHistoryError(err?.message || t("failedToLoadHistory")); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [filterFactory, filterEquipmentId, historyRefresh]);

  const factoryEquipment = useMemo(
    () => allEquipment.filter((eq) => eq["工場"] === filterFactory),
    [allEquipment, filterFactory]
  );

  const selectedEquipmentName = useMemo(() => {
    if (!filterEquipmentId) return "";
    const eq = allEquipment.find(
      (e) => (e._id?.$oid ?? String(e._id)) === filterEquipmentId
    );
    return eq?.name || "";
  }, [allEquipment, filterEquipmentId]);

  function handleFilterFactoryChange(e) {
    setFilterFactory(e.target.value);
    setFilterEquipmentId("");
  }

  async function handleAddSubmit(data) {
    setAddSubmitting(true);
    try {
      await createSetsubiHistoryRecord({ ...data, submittedBy: username });
      setAddOpen(false);
      setHistoryRefresh((n) => n + 1);
    } catch (err) {
      alert(err?.message || t("failedToSaveRecord"));
    } finally {
      setAddSubmitting(false);
    }
  }

  const displayedHistory = useMemo(() => {
    let rows = history;
    if (dateFrom) rows = rows.filter((r) => (r.date || "") >= dateFrom);
    if (dateTo) rows = rows.filter((r) => (r.date || "") <= dateTo);
    return [...rows].sort((a, b) => {
      const da = a.date || "";
      const db = b.date || "";
      return sortDir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
    });
  }, [history, dateFrom, dateTo, sortDir]);

  const tableTitle = filterEquipmentId
    ? selectedEquipmentName
    : filterFactory
    ? filterFactory
    : t("equipmentHistoryTitle");

  return (
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide">
      <PageHeader
        eyebrow={t("equipment")}
        title={t("equipmentHistoryTitle")}
        className="mb-6"
      />

      {/* Filter bar */}
      <div className="dashboard-section mb-6 rounded-2xl p-5">
        {dataError && (
          <div className="mb-4 rounded-2xl border border-error/20 bg-error/10 px-4 py-4 flex gap-3">
            <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 18 }}>report</span>
            <p className="text-sm font-semibold text-on-surface">{dataError}</p>
          </div>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
              {t("factory")}
            </div>
            <select
              value={filterFactory}
              onChange={handleFilterFactoryChange}
              disabled={dataLoading}
              className={inputCls}
            >
              <option value="">{t("selectFactoryOption")}</option>
              {factories.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
              {t("machine")}
            </div>
            <select
              value={filterEquipmentId}
              onChange={(e) => setFilterEquipmentId(e.target.value)}
              disabled={!filterFactory || dataLoading}
              className={inputCls}
            >
              <option value="">
                {!filterFactory ? t("selectFactoryFirstOption") : t("allMachinesOption")}
              </option>
              {factoryEquipment.map((eq) => {
                const id = eq._id?.$oid ?? String(eq._id);
                return (
                  <option key={id} value={id}>{eq.name}</option>
                );
              })}
            </select>
          </div>
          <div className="flex-1">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
              {t("dateRange")}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputCls}
              />
              <span className="text-outline flex-shrink-0">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex items-end gap-3">
            {dataLoading && (
              <div className="flex items-center gap-2 text-sm text-on-surface-variant pb-3">
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                {t("loading")}
              </div>
            )}
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 whitespace-nowrap"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              {t("addEvent")}
            </button>
          </div>
        </div>
      </div>

      {/* History table */}
      <div className="dashboard-section rounded-2xl overflow-hidden">
        {/* Section header */}
        <div className="px-5 py-4 border-b border-separator/40 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>history</span>
          </span>
          <div>
            <h3 className="text-sm font-semibold text-on-surface">{tableTitle}</h3>
            {!historyLoading && history.length > 0 && (
              <p className="text-[11px] text-outline">
                {displayedHistory.length !== history.length
                  ? fillTemplate(t("recordsCountFilteredTemplate"), {
                      shown: displayedHistory.length,
                      total: history.length,
                    })
                  : fillTemplate(t("recordsCountTemplate"), { count: history.length })}
              </p>
            )}
          </div>
        </div>

        {/* Loading */}
        {historyLoading && (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
            {t("loading")}
          </div>
        )}

        {/* Error */}
        {!historyLoading && historyError && (
          <div className="m-5 rounded-2xl border border-error/20 bg-error/10 px-4 py-4 flex gap-3">
            <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 18 }}>report</span>
            <p className="text-sm text-on-surface">{historyError}</p>
          </div>
        )}

        {/* Empty — no factory selected */}
        {!historyLoading && !historyError && !filterFactory && (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>factory</span>
            </div>
            <p className="text-sm font-semibold text-on-surface">{t("selectAFactory")}</p>
            <p className="mt-1 text-[11px] text-outline">
              {t("chooseFactoryPrompt")}
            </p>
          </div>
        )}

        {/* Empty — factory selected, no records */}
        {!historyLoading && !historyError && filterFactory && displayedHistory.length === 0 && (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container">
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 28 }}>event_note</span>
            </div>
            <p className="text-sm font-semibold text-on-surface">{t("noRecordsFoundTitle")}</p>
            <p className="mt-1 text-[11px] text-outline">
              {history.length > 0
                ? t("noRecordsDateRange")
                : filterEquipmentId
                ? t("noRecordsMachine")
                : t("noRecordsFactory")}
            </p>
          </div>
        )}

        {/* Table */}
        {!historyLoading && !historyError && displayedHistory.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-separator/40 bg-surface-container-high">
                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                    <button
                      type="button"
                      onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
                      className="inline-flex items-center gap-1 hover:text-on-surface transition-all duration-150"
                    >
                      {t("date")}
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        {sortDir === "desc" ? "arrow_downward" : "arrow_upward"}
                      </span>
                    </button>
                  </th>
                  {!filterEquipmentId && (
                    <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                      {t("machine")}
                    </th>
                  )}
                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                    {t("reportedBy")}
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                    {t("details")}
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-outline w-12">
                    {t("photos")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator/20">
                {displayedHistory.map((event, i) => {
                  const key = event._id?.$oid ?? event._id ?? i;
                  const hasPhotos =
                    Array.isArray(event.imageURLs) && event.imageURLs.length > 0;
                  return (
                    <tr
                      key={key}
                      onClick={() => setViewingEvent(event)}
                      className="cursor-pointer hover:bg-surface-container/50 transition-all duration-150"
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold text-primary">{event.date || "—"}</span>
                      </td>
                      {!filterEquipmentId && (
                        <td className="px-3 py-3">
                          <p className="text-sm font-semibold text-on-surface">
                            {event.equipmentName || "—"}
                          </p>
                        </td>
                      )}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-sm text-on-surface-variant">{event["名前"] || "—"}</span>
                      </td>
                      <td className="px-3 py-3 max-w-xs">
                        <p className="text-sm text-on-surface truncate">{event.details || "—"}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {hasPhotos && (
                          <span
                            className="material-symbols-outlined text-outline"
                            style={{ fontSize: 16 }}
                          >
                            photo_library
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      {addOpen && (
        <AddEventModal
          factories={factories}
          allEquipment={allEquipment}
          workerNames={workerNames}
          username={username}
          submitting={addSubmitting}
          onClose={() => setAddOpen(false)}
          onSubmit={handleAddSubmit}
        />
      )}

      {/* Event Detail */}
      {viewingEvent && (
        <EventDetailModal
          event={viewingEvent}
          onClose={() => setViewingEvent(null)}
        />
      )}
    </section>
  );
}
