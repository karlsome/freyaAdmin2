import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatSummaryCard from "../components/StatSummaryCard";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
import EmptyState from "../components/EmptyState";
import RecordDetailModal from "../components/RecordDetailModal";
import ReportCard from "../components/dailyReport/ReportCard";
import ReportDetailView from "../components/dailyReport/ReportDetailView";
import { fetchDailyReport } from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";
import { useRecordModal } from "../hooks/useRecordModal";
import { CATEGORY_META, GROUPS, SEVERITY_META, describeFinding, fmtNum, fmtPct, processLabel } from "../utils/dailyReportText";
import "../components/dailyReport/dailyReport.css";

// ─── date helpers (local time; the factories are all in Japan) ───────────────
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function shiftDate(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
function yesterday() {
  return shiftDate(fmtDate(new Date()), -1);
}
function longDate(dateStr, isJa) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(isJa ? "ja-JP" : "en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

// "Checked" marks are a per-viewer convenience, kept in this browser only.
function readChecked(date) {
  try {
    return new Set(JSON.parse(localStorage.getItem(`dailyReport.checked.${date}`) || "[]"));
  } catch {
    return new Set();
  }
}
function writeChecked(date, set) {
  try {
    localStorage.setItem(`dailyReport.checked.${date}`, JSON.stringify([...set]));
  } catch {
    /* storage unavailable — marks just won't persist */
  }
}

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

const PROCESS_ORDER = ["press", "kensa", "srs", "slit"];
const PROCESS_ICON = { press: "precision_manufacturing", kensa: "fact_check", srs: "layers", slit: "content_cut" };

/** Reads the date from the URL; the view below remounts per date so its state starts fresh. */
export default function DailyReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = fmtDate(new Date());
  const rawDate = searchParams.get("date");
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && rawDate <= today ? rawDate : yesterday();
  const factory = searchParams.get("factory") || "All";

  const setParam = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (value && value !== "All") p.set(key, value);
        else p.delete(key);
        return p;
      });
    },
    [setSearchParams]
  );

  return (
    <DailyReportView
      key={date}
      date={date}
      today={today}
      factory={factory}
      setDate={(d) => setParam("date", d)}
      setFactory={(f) => setParam("factory", f)}
    />
  );
}

function DailyReportView({ date, today, factory, setDate, setFactory }) {
  const { t, language } = useLanguage();
  const isJa = language === "ja";
  const isDark = useIsDarkMode();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [checked, setChecked] = useState(() => readChecked(date));
  const { modalRecord, modalProcess, openRecord, closeRecord } = useRecordModal();

  useEffect(() => {
    let alive = true;
    fetchDailyReport(date, { refresh: refreshTick > 0 })
      .then((data) => {
        if (!alive) return;
        setReport(data);
        setError("");
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message || "Failed to load");
        setReport(null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [date, refreshTick]);

  const refresh = () => {
    setLoading(true);
    setRefreshTick((n) => n + 1);
  };

  const findings = useMemo(() => report?.findings || [], [report]);
  const texts = useMemo(() => {
    const m = new Map();
    findings.forEach((f) => m.set(f.id, describeFinding({ ...f, _date: report?.date }, isJa)));
    return m;
  }, [findings, isJa, report?.date]);

  const factories = useMemo(() => report?.factories || [], [report]);
  const activeFactory = factory === "All" || factories.includes(factory) ? factory : "All";
  const byFactory = useMemo(
    () => findings.filter((f) => activeFactory === "All" || f.facs.includes(activeFactory)),
    [findings, activeFactory]
  );
  const visible = useMemo(() => byFactory.filter((f) => category === "all" || f.cat === category), [byFactory, category]);

  const factoryItems = useMemo(
    () =>
      ["All", ...factories].map((f) => ({
        key: f,
        label: f === "All" ? (isJa ? "全工場" : "All") : f,
        badge: findings.filter((x) => f === "All" || x.facs.includes(f)).length,
      })),
    [factories, findings, isJa]
  );
  const categoryItems = useMemo(
    () =>
      [{ key: "all", label: isJa ? "すべて" : "All", badge: byFactory.length }].concat(
        Object.entries(CATEGORY_META).map(([key, meta]) => {
          const n = byFactory.filter((f) => f.cat === key).length;
          return { key, label: isJa ? meta.ja : meta.en, icon: meta.icon, badge: n, disabled: n === 0 };
        })
      ),
    [byFactory, isJa]
  );

  const tiles = useMemo(() => {
    const k = report?.kpis?.[activeFactory];
    if (!k) return [];
    const out = [
      {
        icon: "description",
        label: isJa ? "提出レコード" : "Records submitted",
        value: fmtNum(k.records),
        subtitle: isJa ? `${byFactory.length}件の発見` : `${byFactory.length} findings`,
      },
    ];
    PROCESS_ORDER.forEach((proc) => {
      const p = k.processes?.[proc];
      if (!p) return;
      const worse = p.rate != null && p.baseRate != null && p.rate >= Math.max(1.3 * p.baseRate, p.baseRate + 0.3);
      const better = p.rate != null && p.baseRate != null && p.baseRate > 0 && p.rate <= 0.7 * p.baseRate;
      out.push({
        icon: PROCESS_ICON[proc],
        label: isJa ? `${processLabel(proc, true)}不良率` : `${processLabel(proc, false)} NG`.replace(/^./, (c) => c.toUpperCase()),
        value: fmtPct(p.rate),
        subtitle: isJa
          ? `通常 ${fmtPct(p.baseRate)} · ${fmtNum(p.qty)}個（通常 ${fmtNum(p.baseQty)}）`
          : `normal ${fmtPct(p.baseRate)} · ${fmtNum(p.qty)} pcs (normal ${fmtNum(p.baseQty)})`,
        statusDot: worse ? "defect" : better ? "complete" : undefined,
      });
    });
    if (k.stopCalls) {
      out.push({
        icon: "phone_missed",
        label: isJa ? "ストップコール" : "Stop calls",
        value: fmtNum(k.stopCalls.today),
        subtitle: isJa ? `通常 ${fmtNum(k.stopCalls.base)}件/日` : `normal ${fmtNum(k.stopCalls.base)} a day`,
        statusDot: k.stopCalls.today >= 1.3 * k.stopCalls.base && k.stopCalls.today - k.stopCalls.base >= 5 ? "warning" : undefined,
      });
    }
    return out;
  }, [report, activeFactory, isJa, byFactory.length]);

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({ ...g, items: visible.filter((f) => (SEVERITY_META[f.sev] || SEVERITY_META.info).group === g.key) })).filter(
        (g) => g.items.length
      ),
    [visible]
  );

  const openFinding = findings.find((f) => f.id === openId);
  const toggleCheck = (id) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
    writeChecked(date, next);
  };

  return (
    <section className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      <PageHeader
        eyebrow={t("factories")}
        title={
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[var(--freya-blue)]">summarize</span>
            <span>{isJa ? "デイリーレポート" : "Daily Report"}</span>
          </div>
        }
        subtitle={
          isJa
            ? `${longDate(date, true)} — 各項目の直近30日と比較して目立ったこと`
            : `${longDate(date, false)} — what stood out, compared with each item's last 30 days`
        }
        className="mb-6 md:flex-row md:items-center md:justify-between"
        actions={
          <>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDate(shiftDate(date, -1))}
                aria-label={isJa ? "前日" : "Previous day"}
                className="h-9 w-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center justify-center"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_left</span>
              </button>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label={isJa ? "日付" : "Date"}
                className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
              />
              <button
                type="button"
                onClick={() => setDate(shiftDate(date, 1))}
                disabled={date >= today}
                aria-label={isJa ? "翌日" : "Next day"}
                className="h-9 w-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
              </button>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-1.5"
            >
              <span className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>refresh</span>
              {t("refresh")}
            </button>
          </>
        }
      />

      {error ? (
        <EmptyState icon="error" title={isJa ? "レポートを読み込めませんでした" : "Couldn't load the report"}>
          <p>{error}</p>
        </EmptyState>
      ) : !loading && report && !report.hasData ? (
        <EmptyState icon="event_busy" title={isJa ? "この日の提出データはありません" : "No submissions on this day"}>
          <p>{isJa ? "休日の可能性があります。前の日付を選んでください。" : "It may have been a day off. Try an earlier date."}</p>
        </EmptyState>
      ) : (
        <>
          <LiquidSegmentedControl items={factoryItems} activeKey={activeFactory} onChange={(k) => {
              setFactory(k);
              setCategory("all");
            }} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {loading && !report
              ? Array.from({ length: 5 }).map((_, i) => <StatSummaryCard key={i} variant="freya" label="—" value="" loading />)
              : tiles.map((tile) => <StatSummaryCard key={tile.label} variant="freya" loading={loading} {...tile} />)}
          </div>

          <div className="pb-1 border-b border-[var(--border)]">
            <LiquidSegmentedControl items={categoryItems} activeKey={category} onChange={setCategory} className="mb-3" />
          </div>

          {loading && !report ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="freya-card h-[300px] animate-pulse" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <EmptyState icon="task_alt" title={isJa ? "この条件で目立った点はありません" : "Nothing unusual in this filter"} />
          ) : (
            groups.map((g) => (
              <section key={g.key} className="space-y-3">
                <h2 className="text-h3 text-[var(--text-primary)]">
                  {isJa ? g.ja : g.en} <span className="font-normal text-[var(--text-muted)]">· {g.items.length}</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {g.items.map((f) => (
                    <ReportCard
                      key={f.id}
                      finding={f}
                      text={texts.get(f.id)}
                      isJa={isJa}
                      checked={checked.has(f.id)}
                      onOpen={() => setOpenId(f.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      {openFinding && (
        <ReportDetailView
          finding={openFinding}
          text={texts.get(openFinding.id)}
          isJa={isJa}
          isDark={isDark}
          date={longDate(date, isJa)}
          checked={checked.has(openFinding.id)}
          onToggleCheck={() => toggleCheck(openFinding.id)}
          onClose={() => setOpenId(null)}
          onOpenRecord={(r) => openRecord(r)}
          escDisabled={Boolean(modalRecord)}
        />
      )}

      {modalRecord && (
        // z-[70]: above the full-screen card view (z-60).
        <RecordDetailModal record={modalRecord} processName={modalProcess} onClose={closeRecord} zIndex="z-[70]" />
      )}
    </section>
  );
}
