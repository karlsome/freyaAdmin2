import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchDailyReportList } from "../services/api";
import { useDailyReportCount, yesterdayLocal } from "../hooks/useDailyReportCount";
import { CATEGORY_META, SEVERITY_META, describeFinding } from "../utils/dailyReportText";
import "./dailyReport/dailyReport.css";

const PAGE_SIZE = 15;

/**
 * Top-bar bell: yesterday's Daily Report findings. Opens a popup list that
 * loads 15 at a time ("Load more"); clicking an item opens that card on the
 * report page.
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isJa = language === "ja";
  const count = useDailyReportCount();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState({ date: "", items: [], total: 0, hasMore: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);

  const loadPage = (offset) => {
    setLoading(true);
    setError("");
    const date = yesterdayLocal();
    fetchDailyReportList(date, { offset, limit: PAGE_SIZE })
      .then((page) => {
        setList((prev) => ({
          date: page.date,
          total: page.total,
          hasMore: page.hasMore,
          items: offset === 0 ? page.items : prev.items.concat(page.items),
        }));
      })
      .catch((e) => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadPage(0); // always start from the first 15 when opened
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const goTo = (path) => {
    setOpen(false);
    navigate(path);
  };

  const label = count ? t("dailyReportBell", { n: count }) : t("reports");

  return (
    <div className="relative" ref={ref}>
      <button
        className={`relative p-2 rounded-xl transition-all ${open ? "text-primary bg-primary/10" : "text-outline hover:text-primary hover:bg-primary/10"}`}
        type="button"
        onClick={toggle}
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="material-symbols-outlined">notifications</span>
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold leading-[18px] text-center tabular-nums shadow-sm">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2.5 w-[380px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/20 dark:border-white/10 bg-surface/95 dark:bg-[rgba(15,18,32,0.96)] backdrop-blur-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden">
          <div className="px-4 py-3 border-b border-separator/40 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">{isJa ? "デイリーレポート" : "Daily report"}</p>
              <p className="text-sm font-semibold text-on-surface truncate">
                {isJa ? `昨日（${list.date || yesterdayLocal()}）· ${list.total || count || 0}件` : `Yesterday (${list.date || yesterdayLocal()}) · ${list.total || count || 0} findings`}
              </p>
            </div>
            <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>summarize</span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {error ? (
              <p className="px-3 py-6 text-center text-sm text-[var(--status-defect)]">{error}</p>
            ) : list.items.length === 0 && loading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="m-1.5 h-14 rounded-xl bg-[var(--surface-subtle)] animate-pulse" />)
            ) : list.items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-outline">{isJa ? "昨日は目立った点はありません" : "Nothing stood out yesterday"}</p>
            ) : (
              <ul className="space-y-0.5">
                {list.items.map((f) => {
                  const text = describeFinding({ ...f, _date: list.date }, isJa);
                  const cat = CATEGORY_META[f.cat] || CATEGORY_META.data;
                  const sev = SEVERITY_META[f.sev] || SEVERITY_META.info;
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => goTo(`/factory/reports?date=${list.date}&open=${encodeURIComponent(f.id)}`)}
                        className="w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-primary/10"
                      >
                        <span className="material-symbols-outlined mt-0.5 flex-shrink-0" style={{ fontSize: 18, color: cat.color }}>{cat.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold leading-snug text-on-surface">{text.title}</span>
                          <span className="mt-0.5 block text-[11px] text-outline truncate">
                            {f.facs.join(" · ")} · <span className="font-semibold" style={{ color: sev.color }}>{text.big}</span> · {text.normal}
                          </span>
                        </span>
                        <span className={`${sev.className} flex-shrink-0 !h-5 !px-2 !text-[10px]`}>{isJa ? sev.ja : sev.en}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="px-3 py-2.5 border-t border-separator/40 flex items-center justify-between gap-2">
            {list.hasMore ? (
              <button
                type="button"
                onClick={() => loadPage(list.items.length)}
                disabled={loading}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>{loading ? "progress_activity" : "expand_more"}</span>
                {isJa ? `さらに読み込む（${list.items.length} / ${list.total}）` : `Load more (${list.items.length} of ${list.total})`}
              </button>
            ) : (
              <span className="px-1 text-[11px] text-outline">{list.total ? (isJa ? `全${list.total}件を表示` : `All ${list.total} shown`) : ""}</span>
            )}
            <button
              type="button"
              onClick={() => goTo(`/factory/reports${list.date ? `?date=${list.date}` : ""}`)}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-primary/10 flex items-center gap-1"
            >
              {isJa ? "レポートを開く" : "Open daily report"}
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
