import { useEffect, useState } from "react";
import { fetchDailyReportSummary } from "../services/api";

/**
 * Number of findings in yesterday's Daily Report — the same number as the
 * report page's "All" tab. The page broadcasts DAILY_REPORT_EVENT whenever it
 * loads or refreshes a report, so the bell and the page never disagree.
 */
export const DAILY_REPORT_EVENT = "dailyReport:count";
const POLL_MS = 10 * 60 * 1000;

export function yesterdayLocal() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Called by the report page after it loads a report. */
export function announceDailyReportCount(date, count) {
  window.dispatchEvent(new CustomEvent(DAILY_REPORT_EVENT, { detail: { date, count } }));
}

export function useDailyReportCount() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchDailyReportSummary(yesterdayLocal())
        .then((s) => alive && setCount(Number(s.count) || 0))
        .catch(() => {});
    load();
    const timer = setInterval(load, POLL_MS);
    const onAnnounce = (e) => {
      if (e.detail?.date === yesterdayLocal()) setCount(Number(e.detail.count) || 0);
    };
    window.addEventListener(DAILY_REPORT_EVENT, onAnnounce);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(DAILY_REPORT_EVENT, onAnnounce);
    };
  }, []);

  return count;
}
