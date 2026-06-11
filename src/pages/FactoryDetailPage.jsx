import { useState, useEffect, useCallback, useRef } from "react";
import Hls from "hls.js";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import {
  BASE_URL,
  fetchCombinedEnvironmentalData,
  fetchCombinedSensorData,
  fetchProductionByPeriod,
  fetchSensorData,
  fetchEnvironmentalData,
  checkMaterialSebanggo,
  lookupMaterialLot,
  query,
} from "../services/api";
import { getDefectStatus, getTempStatus, getHumidityStatus, getWBGTStatus } from "../utils/statusHelpers";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
import RecordDetailModal from "../components/RecordDetailModal";
import ProcessPanel from "../components/ProcessPanel";
import ProductionFilterBar from "../components/ProductionFilterBar";
import StatSummaryCard from "../components/StatSummaryCard";
import { useRecordModal } from "../hooks/useRecordModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) { return d.toISOString().split("T")[0]; }
function todayStr() { return fmtDate(new Date()); }

function defectChip(rate) {
  const n = parseFloat(rate);
  if (n > 2) return "bg-error/15 text-error";
  if (n > 1) return "bg-amber-400/15 text-amber-400";
  return "bg-emerald-400/15 text-emerald-400";
}

// ─── MfgLotModal ─────────────────────────────────────────────────────────────
function MfgLotModal({ onClose, initialLot = "" }) {
  const [lotInput, setLotInput]   = useState(initialLot);
  const [step, setStep]           = useState("input");
  const [sebanggoOptions, setSebanggoOptions] = useState([]);
  const [results, setResults]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [errMsg, setErrMsg]       = useState("");

  const doSearch = useCallback(async (lot) => {
    if (!lot || lot.length < 3) return;
    setLoading(true);
    setErrMsg("");
    try {
      const check = await checkMaterialSebanggo(lot);
      if (check?.multiple && Array.isArray(check.options) && check.options.length > 1) {
        setSebanggoOptions(check.options);
        setStep("selecting");
      } else {
        const res = await lookupMaterialLot(lot, check?.sebanggo ?? null);
        setResults(res);
        setStep("results");
      }
    } catch {
      try {
        const rows = await query("submittedDB", "pressDB", { "製造ロット": { $regex: lot, $options: "i" } });
        setResults({ rows });
        setStep("results");
      } catch {
        setErrMsg("Lot not found. Please check the number and try again.");
        setStep("error");
      }
    }
    setLoading(false);
  }, []);

  // Auto-search when opened with a pre-filled lot (e.g. from 材料ロット chip)
  useEffect(() => {
    const t = initialLot.trim();
    if (t.length >= 3) doSearch(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => doSearch(lotInput.trim());

  const handleSelectSebanggo = async (seb) => {
    setLoading(true);
    try {
      const res = await lookupMaterialLot(lotInput.trim(), seb);
      setResults(res);
      setStep("results");
    } catch {
      setErrMsg("Failed to retrieve lot data.");
      setStep("error");
    }
    setLoading(false);
  };

  const rows   = results?.rows ?? (Array.isArray(results) ? results : []);
  const fields = (results && !Array.isArray(results) && !results.rows)
    ? Object.entries(results).filter(([k]) => k !== "rows")
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
      onClick={onClose}
    >
      <div
        className="dashboard-section rounded-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto
                   shadow-[0_0_80px_rgba(99,102,241,0.18),0_24px_48px_rgba(0,0,0,0.22)] scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 flex items-center justify-between border-b border-separator/40">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>manage_search</span>
            <h3 className="text-base font-semibold text-on-surface">Manufacturing Lot Finder</h3>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={lotInput}
              onChange={(e) => setLotInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="製造ロット番号 (例: 241227)"
              className="flex-1 h-10 px-3 rounded-xl bg-surface-container border border-separator/40 text-sm
                         text-on-surface placeholder:text-outline outline-none focus:border-primary/40 transition-colors"
            />
            <button
              onClick={handleSearch}
              disabled={loading || lotInput.trim().length < 3}
              className="px-4 h-10 rounded-xl kinetic-gradient text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {loading ? "…" : "Search"}
            </button>
          </div>

          {step === "selecting" && (
            <div>
              <p className="text-xs text-on-surface-variant mb-3">Multiple matches — select a serial number:</p>
              <div className="space-y-2">
                {sebanggoOptions.map((s) => (
                  <button key={s} onClick={() => handleSelectSebanggo(s)}
                    className="w-full px-4 py-3 rounded-xl glass-card text-left text-sm font-semibold text-on-surface
                               hover:border-primary/30 hover:scale-[1.01] transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "results" && (
            <div className="space-y-3">
              {fields.length > 0 && (
                <div className="glass-card rounded-xl p-5 space-y-2">
                  {fields.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-separator/40 pb-2 last:border-0">
                      <span className="text-[11px] font-semibold text-outline">{k}</span>
                      <span className="text-xs text-on-surface-variant text-right font-mono">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
              {rows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-separator/40">
                  <table className="ui-table-data w-full">
                    <thead className="bg-surface-container-high/50">
                      <tr>
                        {["品番","背番号","Date","Total","Total NG","不良率"].map((h) => (
                          <th key={h} className="ui-table-heading px-4 py-2.5 text-left uppercase tracking-wider text-outline">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-separator/20">
                      {rows.map((r, i) => {
                        const qty = Number(r.Process_Quantity) || Number(r.Total) || 0;
                        const ng  = Number(r.Total_NG) || 0;
                        const dr  = qty > 0 ? ((ng / qty) * 100).toFixed(2) : "0.00";
                        return (
                          <tr key={i} className="hover:bg-surface-container/40 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-on-surface">{r["品番"] ?? "—"}</td>
                            <td className="px-4 py-2.5 text-on-surface-variant">{r["背番号"] ?? "—"}</td>
                            <td className="px-4 py-2.5 text-outline">{r.Date ?? "—"}</td>
                            <td className="px-4 py-2.5 text-on-surface">{qty.toLocaleString()}</td>
                            <td className={`px-4 py-2.5 font-semibold ${ng > 0 ? "text-error" : "text-outline"}`}>{ng}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${defectChip(dr)}`}>{dr}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : fields.length === 0 && (
                <p className="text-sm text-outline text-center py-4">No records found for this lot.</p>
              )}
            </div>
          )}

          {step === "error" && (
            <p className="text-sm text-error text-center py-2">{errMsg}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Camera modal ─────────────────────────────────────────────────────────────

const CAM_LABELS = [
  { id: 'tapo_cam',  label: 'CAM 1' },
  { id: 'tapo_cam2', label: 'CAM 2' },
  { id: 'tapo_cam3', label: 'CAM 3' },
];

function CameraModal({ onClose, stream = 'tapo_cam' }) {
  const videoRef = useRef(null);
  const [activeStream, setActiveStream] = useState(stream);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const src = `${BASE_URL}api/cam?stream=${activeStream}`;
    const camUser = import.meta.env.VITE_CAM_USER || '';
    const camPass = import.meta.env.VITE_CAM_PASS || '';
    const basicAuth = camUser ? 'Basic ' + btoa(`${camUser}:${camPass}`) : '';

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          if (basicAuth) xhr.setRequestHeader("Authorization", basicAuth);
        },
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        lowLatencyMode: false,
        liveBackBufferLength: 0,
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else hls.destroy();
        }
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      return () => hls.destroy();
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.play().catch(() => {});
    }
  }, [activeStream]);

  const activeLabel = CAM_LABELS.find(c => c.id === activeStream)?.label ?? 'CAM 1';
  const otherCams = CAM_LABELS.filter(c => c.id !== activeStream);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="dashboard-section rounded-2xl w-full max-w-5xl flex flex-col overflow-hidden"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-separator/40 px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">小瀬 — Live Camera</p>
            <h2 className="mt-1 text-xl font-semibold text-on-surface">Live Feed — {activeLabel}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
        <div className="relative flex-1 bg-black flex items-center justify-center" style={{ minHeight: "60vh" }}>
          <video
            ref={videoRef}
            className="w-full h-full"
            style={{ maxHeight: "70vh" }}
            controls
            playsInline
            muted
          />
          <div className="absolute bottom-4 right-4 flex gap-2">
            {otherCams.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveStream(c.id)}
                className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-semibold hover:bg-black/80 transition-all border border-white/20 active:scale-95"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
console.log('API URL:', import.meta.env.VITE_API_URL);
// ─── Main page ────────────────────────────────────────────────────────────────
export default function FactoryDetailPage({ combined = false }) {
  const { factoryName: encoded } = useParams();
  const factoryName = combined ? "__all__" : decodeURIComponent(encoded);
  const pageTitle = combined ? "Overview" : factoryName;
  const navigate    = useNavigate();

  const [dateFrom,      setDateFrom]      = useState(todayStr());
  const [dateTo,        setDateTo]        = useState(todayStr());
  const [partNumbers,   setPartNumbers]   = useState([]);
  const [serialNumbers, setSerialNumbers] = useState([]);

  const [prodData,      setProdData]      = useState(null);
  const [sensor,        setSensor]        = useState(null);
  const [env,           setEnv]           = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [activeSection, setActiveSection] = useState("Daily");

  const { modalRecord, modalProcess, openRecord, closeRecord } = useRecordModal();
  const [showLotModal,    setShowLotModal]    = useState(false);
  const [lotModalInitial, setLotModalInitial] = useState("");

  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const loadData = useCallback(async (from = dateFrom, to = dateTo, parts = partNumbers, serials = serialNumbers, filters = []) => {
    setLoading(true);
    const [p, s, e] = await Promise.allSettled([
      fetchProductionByPeriod(combined ? null : factoryName, from, to, parts, serials, filters),
      combined ? fetchCombinedSensorData(from) : fetchSensorData(factoryName, from),
      combined ? fetchCombinedEnvironmentalData() : fetchEnvironmentalData(factoryName),
    ]);
    if (p.status === "fulfilled") {
      setProdData(p.value);
      setActiveSection(Object.keys(p.value.sections)[0]);
    }
    if (s.status === "fulfilled") setSensor(s.value);
    if (e.status === "fulfilled") setEnv(e.value);
    setLoading(false);
  }, [combined, factoryName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load on mount
  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sections     = prodData?.sections ?? {};
  const sectionNames = Object.keys(sections);
  const currentRows  = sections[activeSection] ?? {};

  // Summary stats from the first (most granular) section
  const firstSection = sections[sectionNames[0]] ?? {};
  const allFlat      = Object.values(firstSection).flat();
  const stripTotal   = allFlat.reduce((s, r) => s + (Number(r.Process_Quantity) || Number(r.Total) || 0), 0);
  const stripNG      = allFlat.reduce((s, r) => s + (Number(r.Total_NG) || 0), 0);
  const stripRate    = stripTotal > 0 ? Math.round((stripNG / stripTotal) * 10000) / 100 : 0;
  const defStatus    = getDefectStatus(stripRate);

  // Per-process stats
  const PROCESS_ACCENT = {
    Kensa: { color: "text-violet-500", bg: "bg-violet-500/10" },
    Press: { color: "text-sky-500", bg: "bg-sky-500/10" },
    SRS: { color: "text-amber-500", bg: "bg-amber-500/10" },
    Slit: { color: "text-emerald-500", bg: "bg-emerald-500/10" },
  };
  const perProcess = ["Kensa", "Press", "SRS", "Slit"].map((proc) => {
    const rows  = (firstSection[proc] ?? []);
    const total = rows.reduce((s, r) => s + (Number(r.Process_Quantity) || Number(r.Total) || 0), 0);
    const ng    = rows.reduce((s, r) => s + (Number(r.Total_NG) || 0), 0);
    const rate  = total > 0 ? Math.round((ng / total) * 10000) / 100 : 0;
    return { proc, total, ng, rate, accent: PROCESS_ACCENT[proc] ?? { color: "text-primary", bg: "bg-primary/10" } };
  });

  const overviewSummaryCards = [
    {
      key: "total-processed",
      icon: "output",
      label: "Total Processed",
      value: stripTotal.toLocaleString(),
      subtitle: "units processed",
      accent: "text-primary bg-primary/10",
    },
    {
      key: "ng-units",
      icon: "report",
      label: "NG Units",
      value: stripNG.toLocaleString(),
      subtitle: "defective units",
      accent: stripNG > 0 ? "text-error bg-error/10" : "text-emerald-500 bg-emerald-500/10",
    },
    {
      key: "defect-rate",
      icon: "percent",
      label: "Defect Rate",
      value: `${stripRate.toFixed(2)}%`,
      subtitle: defStatus.label,
      accent:
        stripRate >= 2
          ? "text-error bg-error/10"
          : stripRate >= 1.5
            ? "text-amber-500 bg-amber-500/10"
            : "text-emerald-500 bg-emerald-500/10",
    },
    {
      key: "sensors",
      icon: "sensors",
      label: combined ? "Total Sensors" : "Sensors Online",
      value: String(sensor?.sensorCount ?? 0),
      subtitle: combined ? "connected sensors across factories" : "active sensor devices",
      accent: sensor?.hasData ? "text-emerald-500 bg-emerald-500/10" : "text-outline bg-surface-container-high",
    },
  ];

  return (
    <section className="pt-24 pb-20 px-4 md:px-8 overflow-y-auto h-screen scrollbar-hide">
      <PageHeader
        leading={(
          <button
            onClick={() => navigate(combined ? "/factories" : "/dashboard")}
            className="mt-1 p-2 rounded-xl hover:bg-surface-container text-outline hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        bodyClassName="items-start"
        title={pageTitle}
        titleMeta={!loading ? (
          <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded-full ${defStatus.bg} ${defStatus.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${defStatus.dot}`} />
            {defStatus.label}
          </span>
        ) : null}
        subtitle={`${combined ? "All Factories Combined -" : "Factory Overview -"} ${dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`}`}
        className="mb-6 md:flex-row md:items-start md:justify-between"
        actions={(
          <>
            {!combined && factoryName === "小瀬" && (
              <button
                onClick={() => setCameraModalOpen(true)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-separator/40 bg-surface text-on-surface hover:bg-surface-container hover:border-primary/30 hover:text-primary active:scale-95 transition-all duration-150"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>
                View Live Feed
              </button>
            )}

            <button
              onClick={() => navigate(combined ? "/sensors" : `/sensors/${encoded}`)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                         kinetic-gradient text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sensors</span>
              {combined ? "Sensor Overview" : "Sensor History"}
            </button>
          </>
        )}
      />

      {/* ── Summary strip ── */}
      <div className="space-y-3 mb-6">
        {/* Row 1: overall */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {overviewSummaryCards.map((card) => (
            <StatSummaryCard
              key={card.key}
              icon={card.icon}
              label={card.label}
              value={card.value}
              subtitle={card.subtitle}
              accent={card.accent}
              loading={loading}
            />
          ))}
        </div>
        {/* Row 2: per-process */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {perProcess.map(({ proc, total, ng, rate, accent }) => {
            const ds = getDefectStatus(rate);
            return (
              <StatSummaryCard
                key={proc}
                icon="precision_manufacturing"
                label={`${proc} Process`}
                labelClassName={accent.color}
                value={total > 0 ? total.toLocaleString() : "—"}
                subtitle={
                  total > 0
                    ? <><span className={ds.valueColor}>{rate.toFixed(2)}%</span>{" · "}{ng.toLocaleString()} NG</>
                    : "No data"
                }
                subtitleClassName={total > 0 ? "text-on-surface-variant" : ""}
                accent={`${accent.color} ${accent.bg}`}
                loading={loading}
              />
            );
          })}
        </div>
      </div>

      {/* ── Env / sensor strip ── */}
      {(env || sensor?.hasData) && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {env && (
            <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-5">
              <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 24 }}>cloud</span>
              <div className="flex gap-6 flex-wrap flex-1">
                {[
                  { label: "Temp",     value: `${env.temperature ?? "—"}°C`, status: getTempStatus(env.temperature) },
                  { label: "Humidity", value: `${env.humidity ?? "—"}%`,     status: getHumidityStatus(env.humidity) },
                ].map(({ label, value, status }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">{label}</span>
                    <span className={`text-base font-semibold ${status.color}`}>{value}</span>
                  </div>
                ))}
              </div>
              {env.isDefault && <span className="text-[10px] text-outline">Simulated</span>}
            </div>
          )}
          {sensor?.hasData && (
            <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-5">
              <span className="material-symbols-outlined text-tertiary flex-shrink-0" style={{ fontSize: 24 }}>sensors</span>
              <div className="flex gap-6 flex-wrap">
                {[
                  { label: "Peak Temp",    value: `${sensor.highestTemp}°C`,      status: getTempStatus(sensor.highestTemp) },
                  { label: "Avg Humidity", value: `${sensor.averageHumidity}%`,   status: getHumidityStatus(sensor.averageHumidity) },
                  ...(sensor.wbgt != null ? [{ label: "WBGT", value: `${sensor.wbgt}°C`, status: getWBGTStatus(sensor.wbgt) }] : []),
                ].map(({ label, value, status }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">{label}</span>
                    <span className={`text-base font-semibold ${status.color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filter bar ── */}
      <ProductionFilterBar
        factoryName={combined ? "__all__" : factoryName}
        defaultDateFrom={dateFrom}
        defaultDateTo={dateTo}
        loading={loading}
        onApply={({ dateFrom: f, dateTo: t, partNumbers: p, serialNumbers: s, advancedFilters: af }) => {
          setDateFrom(f); setDateTo(t); setPartNumbers(p); setSerialNumbers(s);
          loadData(f, t, p, s, af);
        }}
        onLotFinderOpen={() => setShowLotModal(true)}
      />

      {/* ── Daily Production ── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-separator/40 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>factory</span>
            Daily Production
          </h3>
          {sectionNames.length > 1 && (
            <LiquidSegmentedControl
              items={sectionNames}
              activeKey={activeSection}
              onChange={setActiveSection}
            />
          )}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card rounded-2xl h-72 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {["Kensa", "Press", "SRS", "Slit"].map((proc) => (
                <ProcessPanel
                  key={`${activeSection}_${proc}`}
                  processName={proc}
                  rows={currentRows[proc] ?? []}
                  showFactoryColumn={combined}
                  onRowClick={(record, pName) => {
                    openRecord(record, pName);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Record detail modal ── */}
      {modalRecord && (
        <RecordDetailModal
          record={modalRecord}
          processName={modalProcess}
          onClose={closeRecord}
          onLotClick={(lot) => { setLotModalInitial(lot); setShowLotModal(true); }}
        />
      )}

      {/* ── Manufacturing lot modal ── */}
      {showLotModal && (
        <MfgLotModal
          initialLot={lotModalInitial}
          onClose={() => { setShowLotModal(false); setLotModalInitial(""); }}
        />
      )}

      {cameraModalOpen && (
        <CameraModal onClose={() => setCameraModalOpen(false)} />
      )}
    </section>
  );
}
