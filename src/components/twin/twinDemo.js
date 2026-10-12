/**
 * Preview mode (?demo=1): overlays plausible live states on the real snapshot so the
 * twin can be checked outside working hours. Display-only; never written anywhere.
 */
const DEMO_STATUS = {
  OZNC01: "running", OZNC02: "running", OZNC05: "running", OZNC07: "running",
  OZNC11: "running", OZNC12: "running", OZNC13: "running", OZNC14: "running",
  OZNC15: "running", OZNC16: "idle", OZNC17: "stopCall", OZNC18: "break",
  OZNC03: "off", OZMANAS: "running",
};
const DEMO_PAIRS = { OZNC04: "OZNC06", OZNC08: "OZNC10", OZNC09: "OZNC07" };

export function isDemoMode() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
}

export function applyDemo(data) {
  if (!data) return data;
  const byId = Object.fromEntries((data.machines || []).map((m) => [m.id, { ...m }]));
  const ensure = (id) => {
    byId[id] = byId[id] || { id, status: "off", todayCycles: 0, pieces: null, pair: null };
    return byId[id];
  };
  const now = Date.now();

  Object.entries(DEMO_STATUS).forEach(([id, status], i) => {
    const m = ensure(id);
    const cycles = status === "off" ? 0 : 40 + ((i * 37) % 120);
    m.status = status;
    m.todayCycles = cycles;
    m.cycle = cycles + Math.floor(now / 15000) % 3; // ticks up so the cycle flash is visible
    m.pcPerCycle = m.pcPerCycle || (i % 2 ? 18 : 4);
    m.pieces = cycles * m.pcPerCycle;
    m.secondsSinceCycle = status === "running" ? 12 + i : status === "idle" ? 14 * 60 : null;
    m.worker = m.worker || ["河村", "小林", "武藤", "熊澤", "大澤"][i % 5];
    m.sebanggo = m.sebanggo || ["5GD", "6GD", "1TD", "2GL", "5TN"][i % 5];
    m.alertSince = ["stopCall", "break"].includes(status) ? new Date(now - 6 * 60000).toISOString() : null;
    if (m.pair && !DEMO_PAIRS[id] && !Object.values(DEMO_PAIRS).includes(id)) m.pair = { partner: m.pair.partner, together: false };
  });

  Object.entries(DEMO_PAIRS).forEach(([leadId, partnerId], i) => {
    const lead = ensure(leadId);
    const partner = ensure(partnerId);
    const status = i === 1 ? "idle" : "running";
    const cycles = 120 + i * 30;
    lead.status = status;
    lead.todayCycles = cycles;
    lead.cycle = cycles + Math.floor(now / 15000) % 3;
    lead.pcPerCycle = lead.pcPerCycle || 4;
    lead.pieces = cycles * lead.pcPerCycle;
    lead.secondsSinceCycle = status === "running" ? 9 : 12 * 60;
    lead.worker = lead.worker || "ジョハーティ (Joharty)";
    lead.sebanggo = lead.sebanggo || "1TD";
    partner.status = "idle";
    partner.todayCycles = 0;
    partner.pieces = 0;
    const shared = { together: true, status, sharedCycles: cycles, sharedPieces: lead.pieces, worker: lead.worker, sebanggo: lead.sebanggo };
    lead.pair = { partner: partnerId, ...shared };
    partner.pair = { partner: leadId, ...shared };
  });

  return { ...data, goal: data.goal || 17520, machines: Object.values(byId) };
}
