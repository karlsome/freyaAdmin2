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

const SCNA_DEMO_STATUS = {
  "AOL-1": "running",
  "AOL-4": "running",
  "AOL-5": "idle",
  "SCNA-MANAS": "running",
  "SCNA-PSA": "running",
  "SRS 1": "running",
  "SRS 2": "break",
};
// Demonstrates AOL-2 & AOL-3 running as a pair while AOL-4 & AOL-5 run solo (and AOL-1 is always solo)
const SCNA_DEMO_PAIRS = { "AOL-2": "AOL-3" };

function makeDemoRuns(id, status, i) {
  if (status === "off") {
    return {
      completedRuns: [],
      timeline: [{ type: "off", start: "08:00", end: "19:00", durationMin: 660, label: "未稼働" }],
      timelineSummary: { runningMin: 0, idleMin: 0, setupMin: 0, breakMin: 0, stopCallMin: 0, offMin: 660, totalShiftMin: 660, shiftStart: "08:00", shiftEnd: "19:00", uptimePercent: 0 },
    };
  }
  const baseShots = 35 + ((i * 23) % 45);
  const pc = i % 2 ? 18 : 4;
  const worker = ["河村", "小林", "武藤", "熊澤", "大澤", "ベンジー", "ノエミ"][i % 7];
  const sebanggoSets = [
    ["1PM", "1TN", "4TN"],
    ["7GD", "7TD"],
    ["6TD", "6GD"],
    ["5TD", "5GD", "5TN"],
    ["8PD", "8GN", "6GN", "7GN"],
  ];
  const sebanggos = sebanggoSets[i % sebanggoSets.length];

  const runs = [];
  let curHour = 8;
  let curMin = 30;
  sebanggos.forEach((seb, idx) => {
    const sH = String(curHour).padStart(2, "0");
    const sM = String(curMin).padStart(2, "0");
    const duration = 60 + ((idx * 19) % 35);
    curMin += duration;
    while (curMin >= 60) {
      curHour += 1;
      curMin -= 60;
    }
    const eH = String(curHour).padStart(2, "0");
    const eM = String(curMin).padStart(2, "0");
    const shots = baseShots + idx * 6;
    const pieces = shots * pc;
    runs.push({
      sebanggo: seb,
      hinban: `742${idx}-X1B${idx}-A${i}`,
      start: `${sH}:${sM}`,
      end: `${eH}:${eM}`,
      shots,
      pieces,
      worker,
      durationMin: duration,
    });
    curMin += 8;
    while (curMin >= 60) {
      curHour += 1;
      curMin -= 60;
    }
  });

  const segments = [];
  segments.push({ type: "idle", start: "08:00", end: "08:30", durationMin: 30, label: "段取待機" });
  runs.forEach((r, idx) => {
    if (idx > 0) {
      segments.push({ type: "setup", start: runs[idx - 1].end, end: r.start, durationMin: 8, label: "段取切替" });
    }
    if (r.start < "12:00" && r.end > "12:30") {
      segments.push({ type: "running", start: r.start, end: "12:00", durationMin: 35, sebanggo: r.sebanggo, worker: r.worker, label: r.sebanggo });
      segments.push({ type: "break", start: "12:00", end: "12:45", durationMin: 45, label: "昼休憩" });
      segments.push({ type: "running", start: "12:45", end: r.end, durationMin: 25, sebanggo: r.sebanggo, worker: r.worker, label: r.sebanggo });
    } else {
      segments.push({ type: "running", start: r.start, end: r.end, durationMin: r.durationMin, sebanggo: r.sebanggo, worker: r.worker, label: r.sebanggo });
    }
  });

  if (status === "stopCall") {
    segments.push({ type: "stopCall", start: runs[runs.length - 1]?.end || "16:00", end: "17:15", durationMin: 75, label: "呼出停止" });
    segments.push({ type: "idle", start: "17:15", end: "19:00", durationMin: 105, label: "待機" });
  } else if (status === "break") {
    segments.push({ type: "break", start: runs[runs.length - 1]?.end || "15:00", end: "15:30", durationMin: 30, label: "午後休憩" });
    segments.push({ type: "running", start: "15:30", end: "19:00", durationMin: 210, sebanggo: runs[runs.length - 1]?.sebanggo || "7GD", worker, label: "稼働中" });
  } else if (status === "idle") {
    segments.push({ type: "idle", start: runs[runs.length - 1]?.end || "16:30", end: "19:00", durationMin: 150, label: "待機中" });
  } else {
    const lastSeg = segments[segments.length - 1];
    if (lastSeg && lastSeg.end < "19:00") {
      segments.push({ type: "running", start: lastSeg.end, end: "19:00", durationMin: 70, sebanggo: runs[runs.length - 1]?.sebanggo || "1PM", worker, label: "稼働中" });
    }
  }

  let runningMin = 0, idleMin = 0, setupMin = 0, breakMin = 0, stopCallMin = 0;
  segments.forEach((s) => {
    if (s.type === "running") runningMin += s.durationMin;
    else if (s.type === "idle") idleMin += s.durationMin;
    else if (s.type === "setup") setupMin += s.durationMin;
    else if (s.type === "break") breakMin += s.durationMin;
    else if (s.type === "stopCall") stopCallMin += s.durationMin;
  });
  const operating = runningMin + idleMin + setupMin + stopCallMin;
  const uptimePercent = operating > 0 ? Math.round((runningMin / operating) * 100) : 0;

  return {
    completedRuns: runs,
    timeline: segments,
    timelineSummary: {
      runningMin, idleMin, setupMin, breakMin, stopCallMin,
      totalShiftMin: 660, shiftStart: "08:00", shiftEnd: "19:00",
      uptimePercent,
    },
  };
}

const GENERIC_DEMO_CYCLE = ["running", "running", "idle", "running", "break", "running", "stopCall", "off"];

/** Preview for factories without a hand-tuned demo: rotate plausible states over recently used machines. */
function applyGenericDemo(data) {
  const now = Date.now();
  const machines = (data.machines || []).map((orig, i) => {
    const m = { ...orig };
    if (!m.recentlyUsed) return m;
    const status = GENERIC_DEMO_CYCLE[i % GENERIC_DEMO_CYCLE.length];
    const demoInfo = makeDemoRuns(m.id, status, i);
    const pieces = demoInfo.completedRuns.reduce((sum, r) => sum + r.pieces, 0);
    m.status = status;
    m.pieces = status === "off" ? null : pieces;
    m.todayCycles = demoInfo.completedRuns.reduce((sum, r) => sum + r.shots, 0);
    m.worker = m.worker || ["河村", "小林", "武藤", "熊澤", "大澤"][i % 5];
    m.sebanggo = m.sebanggo || ["5GD", "6GD", "1TD", "2GL", "5TN"][i % 5];
    m.sessionStartedAt = status === "running" ? new Date(now - (25 + i * 7) * 60000).toISOString() : null;
    m.alertSince = ["stopCall", "break"].includes(status) ? new Date(now - 6 * 60000).toISOString() : null;
    m.completedRuns = demoInfo.completedRuns;
    m.timeline = demoInfo.timeline;
    m.timelineSummary = demoInfo.timelineSummary;
    return m;
  });
  const goal = data.goal || machines.reduce((sum, m) => sum + (m.pieces || 0), 0) * 1.2;
  return { ...data, goal: Math.round(goal), machines };
}

export function isDemoMode() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
}

export function applyDemo(data, factoryOverride) {
  if (!data && !factoryOverride) return data;
  const baseData = data || { factory: factoryOverride, machines: [] };
  const targetFactory = factoryOverride || baseData.factory || "小瀬";
  const isScna = String(targetFactory).toUpperCase().includes("SCNA");
  const isKose = targetFactory === "小瀬" || String(targetFactory).toLowerCase().includes("oze");
  if (!isKose && !isScna) return applyGenericDemo(baseData);

  const statusMap = isScna ? SCNA_DEMO_STATUS : DEMO_STATUS;
  const pairsMap = isScna ? SCNA_DEMO_PAIRS : DEMO_PAIRS;

  const byId = Object.fromEntries((baseData.machines || []).map((m) => [m.id, { ...m }]));
  const ensure = (id) => {
    byId[id] = byId[id] || {
      id,
      status: "off",
      todayCycles: 0,
      pieces: null,
      pair: null,
      hasCycleSensor: true,
      tableLength: id === "AOL-1" ? 2500 : id.startsWith("AOL-") ? 1200 : undefined,
      noOfHead: id.startsWith("AOL-") ? 1 : undefined,
    };
    return byId[id];
  };
  const now = Date.now();

  Object.entries(statusMap).forEach(([id, status], i) => {
    const m = ensure(id);
    const demoInfo = makeDemoRuns(id, status, i);
    const runsPieces = demoInfo.completedRuns.reduce((sum, r) => sum + r.pieces, 0);
    const runsShots = demoInfo.completedRuns.reduce((sum, r) => sum + r.shots, 0);
    const cycles = status === "off" ? 0 : runsShots || (40 + ((i * 37) % 120));

    m.status = status;
    m.todayCycles = cycles;
    m.cycle = cycles + Math.floor(now / 15000) % 3;
    m.pcPerCycle = m.pcPerCycle || (i % 2 ? 18 : 4);
    m.pieces = runsPieces || (cycles * m.pcPerCycle);
    m.secondsSinceCycle = status === "running" ? 12 + i : status === "idle" ? 14 * 60 : null;
    m.worker = m.worker || ["河村", "小林", "武藤", "熊澤", "大澤"][i % 5];
    m.sebanggo = m.sebanggo || ["5GD", "6GD", "1TD", "2GL", "5TN"][i % 5];
    m.alertSince = ["stopCall", "break"].includes(status) ? new Date(now - 6 * 60000).toISOString() : null;
    m.completedRuns = demoInfo.completedRuns;
    m.timeline = demoInfo.timeline;
    m.timelineSummary = demoInfo.timelineSummary;

    if (m.pair && !pairsMap[id] && !Object.values(pairsMap).includes(id)) {
      m.pair = { partner: m.pair.partner, together: false };
    }
  });

  Object.entries(pairsMap).forEach(([leadId, partnerId], i) => {
    const lead = ensure(leadId);
    const partner = ensure(partnerId);
    const status = i === 1 ? "idle" : "running";
    const demoInfo = makeDemoRuns(leadId, status, i + 10);
    const runsPieces = demoInfo.completedRuns.reduce((sum, r) => sum + r.pieces, 0);
    const runsShots = demoInfo.completedRuns.reduce((sum, r) => sum + r.shots, 0);
    const cycles = runsShots || (120 + i * 30);

    lead.status = status;
    lead.todayCycles = cycles;
    lead.cycle = cycles + Math.floor(now / 15000) % 3;
    lead.pcPerCycle = lead.pcPerCycle || 4;
    lead.pieces = runsPieces || (cycles * lead.pcPerCycle);
    lead.secondsSinceCycle = status === "running" ? 9 : 12 * 60;
    lead.worker = lead.worker || "ジョハーティ (Joharty)";
    lead.sebanggo = lead.sebanggo || "1TD";
    lead.completedRuns = demoInfo.completedRuns;
    lead.timeline = demoInfo.timeline;
    lead.timelineSummary = demoInfo.timelineSummary;

    partner.status = "idle";
    partner.todayCycles = 0;
    partner.pieces = 0;
    partner.completedRuns = demoInfo.completedRuns;
    partner.timeline = demoInfo.timeline;
    partner.timelineSummary = demoInfo.timelineSummary;

    const shared = {
      together: true,
      status,
      sharedCycles: cycles,
      sharedPieces: lead.pieces,
      worker: lead.worker,
      sebanggo: lead.sebanggo,
      completedRuns: demoInfo.completedRuns,
    };
    lead.pair = { partner: partnerId, ...shared };
    partner.pair = { partner: leadId, ...shared };
  });

  // For SCNA solo pair-capable machines (AOL-4 & AOL-5), indicate their partner link while running solo
  if (isScna && byId["AOL-4"] && byId["AOL-5"]) {
    byId["AOL-4"].pair = { partner: "AOL-5", together: false };
    byId["AOL-5"].pair = { partner: "AOL-4", together: false };
  }

  return { ...baseData, goal: baseData.goal || (isScna ? 8400 : 17520), machines: Object.values(byId) };
}
