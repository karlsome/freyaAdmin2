import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchRecordByKey } from "../services/api";

// Maps _source (collection name) → process short name
export const SOURCE_TO_PROC = {
  kensaDB: "Kensa",
  pressDB: "Press",
  SRSDB:   "SRS",
  slitDB:  "Slit",
};

/**
 * Manages a record detail modal with URL sync.
 *
 * When a record is opened, URL params r_proc / r_f / r_dt / r_ts / r_h are
 * pushed so the link is shareable. On page load, if those params are present
 * the record is auto-fetched and the modal re-opens.
 *
 * Usage:
 *   const { modalRecord, modalProcess, openRecord, closeRecord } = useRecordModal();
 *   openRecord(record)               // process derived from _source / _process
 *   openRecord(record, "Kensa")      // explicit process name
 */
export function useRecordModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalRecord,  setModalRecord]  = useState(null);
  const [modalProcess, setModalProcess] = useState("");

  // Auto-open from URL on mount
  useEffect(() => {
    const proc   = searchParams.get("r_proc");
    const f      = searchParams.get("r_f");
    const date   = searchParams.get("r_dt");
    const ts     = searchParams.get("r_ts");
    const hinban = searchParams.get("r_h");
    if (!proc || !f || !date || !ts || !hinban) return;

    fetchRecordByKey(proc, { 工場: f, Date: date, Time_start: ts, 品番: hinban }).then((r) => {
      if (r) {
        setModalRecord(r);
        setModalProcess(proc);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openRecord(record, processName) {
    const proc =
      processName ??
      SOURCE_TO_PROC[record._source] ??
      record._process ??
      "";
    setModalRecord(record);
    setModalProcess(proc);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("r_proc", proc);
        next.set("r_f",    record["工場"]      ?? "");
        next.set("r_dt",   record.Date         ?? "");
        next.set("r_ts",   record.Time_start   ?? "");
        next.set("r_h",    record["品番"]      ?? "");
        return next;
      },
      { replace: false }
    );
  }

  function closeRecord() {
    setModalRecord(null);
    setModalProcess("");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ["r_proc", "r_f", "r_dt", "r_ts", "r_h"].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true }
    );
  }

  return { modalRecord, modalProcess, openRecord, closeRecord };
}
