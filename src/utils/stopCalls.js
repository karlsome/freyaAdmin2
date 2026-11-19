/**
 * Flattens press records (with StopCall.records) into one event per call,
 * keeping the parent record for the detail modal.
 */
export function flattenStopCalls(records) {
  const events = [];
  for (const rec of records) {
    if (!rec.StopCall?.records?.length) continue;
    for (const sc of rec.StopCall.records) {
      events.push({
        ...sc,
        date: rec.Date,
        "設備": rec["設備"],
        "背番号": rec["背番号"],
        "品番": rec["品番"],
        Worker_Name: rec.Worker_Name,
        "工場": rec["工場"],
        parentRecord: rec,
      });
    }
  }
  return events;
}
