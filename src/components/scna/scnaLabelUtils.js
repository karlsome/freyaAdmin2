// Shared helpers for the SCNA label explorer / item search / assign modals.

// Which layouts an item would print with, in the same order the print server resolves them:
// assigned layouts, then the old customer rule, then the default layout, else the built-in label.
export function effectiveLayouts(item, layouts) {
  const byId = new Map(layouts.map((l) => [l.layoutId, l]));
  const assigned = (item.layoutIds || []).map((id) => byId.get(id)).filter(Boolean);
  if (assigned.length) return { source: "assigned", layouts: assigned };
  const customer = item["顧客/納入先"];
  if (customer) {
    const byCustomer = layouts.filter((l) => (l.customers || []).includes(customer));
    if (byCustomer.length) return { source: "customer", layouts: byCustomer };
  }
  const def = layouts.find((l) => l.isDefault);
  if (def) return { source: "default", layouts: [def] };
  return { source: "none", layouts: [] };
}

export function hasAssignedLayout(item, layouts) {
  return effectiveLayouts(item, layouts).source === "assigned";
}

// SCNA processes a label layout can belong to. `press` is the only one with a tablet page wired up so far.
export const LABEL_PROCESSES = ["PSA", "press", "SRS", "kensa"];
export const LABEL_PROCESS_NAMES = {
  PSA: { en: "PSA", ja: "PSA" },
  press: { en: "Press", ja: "プレス" },
  SRS: { en: "SRS", ja: "SRS" },
  kensa: { en: "Kensa", ja: "検査" },
};
export const layoutProcesses = (doc) => (Array.isArray(doc?.processes) && doc.processes.length ? doc.processes : ["press"]);

// Items as one process sees them: layoutIds is that process's binding.
export const itemsForProcess = (items, process) => items.map((i) => ({ ...i, layoutIds: i.layoutIdsByProcess?.[process] || [] }));
