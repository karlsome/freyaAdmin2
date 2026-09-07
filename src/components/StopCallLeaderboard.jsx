import { useState, useMemo } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import DataTable from "./DataTable";

function fmtWait(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function RoleBadge({ role }) {
  const color = role === "admin"
    ? "border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]"
    : role === "班長"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-500"
      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-500";

  return (
    <span className={`inline-block rounded-[4px] border px-1.5 py-0.5 text-[10px] font-mono font-medium ${color}`}>
      {role}
    </span>
  );
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

function RankBadge({ rank }) {
  if (rank <= 3) {
    return <span className="text-lg leading-none">{RANK_MEDALS[rank - 1]}</span>;
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-[var(--surface-subtle)] border border-[var(--border)] font-mono text-xs font-semibold text-[var(--text-muted)]">
      {rank}
    </span>
  );
}

/**
 * Build leader aggregation from flattened stop call events.
 * Each event: { leaderName, leaderUsername, leaderRole, waitSeconds, date, 設備, 背番号, 品番, Worker_Name, 工場, parentRecord }
 */
export function aggregateLeaders(flatEvents) {
  const map = new Map();

  for (const ev of flatEvents) {
    const key = ev.leaderUsername || ev.leaderName;
    if (!map.has(key)) {
      map.set(key, {
        leaderName: ev.leaderName,
        leaderUsername: ev.leaderUsername,
        leaderRole: ev.leaderRole,
        totalResponses: 0,
        totalWaitSeconds: 0,
        minWait: Infinity,
        maxWait: 0,
        dailyCounts: {},
        records: [],
      });
    }
    const leader = map.get(key);
    leader.totalResponses += 1;
    leader.totalWaitSeconds += ev.waitSeconds || 0;
    if ((ev.waitSeconds || 0) < leader.minWait) leader.minWait = ev.waitSeconds || 0;
    if ((ev.waitSeconds || 0) > leader.maxWait) leader.maxWait = ev.waitSeconds || 0;
    leader.dailyCounts[ev.date] = (leader.dailyCounts[ev.date] || 0) + 1;
    leader.records.push(ev);
  }

  const leaders = [];
  for (const leader of map.values()) {
    const avg = leader.totalResponses > 0 ? leader.totalWaitSeconds / leader.totalResponses : 0;
    const score = (leader.totalResponses * 10) / (avg + 1);
    leaders.push({
      ...leader,
      avgWaitSeconds: avg,
      effectivenessScore: Math.round(score * 10) / 10,
    });
  }

  // Sort by effectiveness score descending (higher = better)
  leaders.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
  return leaders;
}

function DailyBar({ dailyCounts }) {
  const days = Object.entries(dailyCounts).sort(([a], [b]) => a.localeCompare(b));
  if (days.length === 0) return null;
  const max = Math.max(...days.map(([, c]) => c));

  return (
    <div className="flex items-end gap-0.5 h-6">
      {days.map(([day, count]) => (
        <div
          key={day}
          title={`${day}: ${count}`}
          className="w-2 rounded-sm bg-[var(--freya-blue)]/60 transition-all hover:bg-[var(--freya-blue)]"
          style={{ height: `${Math.max((count / max) * 100, 15)}%` }}
        />
      ))}
    </div>
  );
}

function LeaderCard({ leader, rank, onClickRecord }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState(null);

  const sortedRecords = useMemo(() => {
    if (!sort || !sort.column) return leader.records;
    return [...leader.records].sort((a, b) => {
      let valA = a[sort.column];
      let valB = b[sort.column];
      // handle waitSeconds separately because they are numbers
      if (sort.column === "waitSeconds") {
         valA = Number(valA) || 0;
         valB = Number(valB) || 0;
      } else {
         valA = String(valA || "").toLowerCase();
         valB = String(valB || "").toLowerCase();
      }
      if (valA < valB) return sort.direction === "asc" ? -1 : 1;
      if (valA > valB) return sort.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [leader.records, sort]);

  const totalItems = sortedRecords.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedRecords = sortedRecords.slice((page - 1) * pageSize, page * pageSize);

  const accentBorder = rank === 1
    ? "border-amber-400/40 shadow-xs"
    : rank === 2
      ? "border-slate-300/40"
      : rank === 3
        ? "border-orange-400/30"
        : "border-[var(--border)]";

  return (
    <div className={`freya-card rounded-[8px] border bg-[var(--surface)] shadow-sm transition-all overflow-hidden ${accentBorder}`}>
      <button
        type="button"
        className="w-full text-left p-4"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-3.5">
          <RankBadge rank={rank} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{leader.leaderName}</span>
              <RoleBadge role={leader.leaderRole} />
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">@{leader.leaderUsername}</p>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Stats */}
            <div className="hidden sm:flex items-center gap-4">
              <div className="text-center">
                <p className="text-base font-bold font-mono text-[var(--text-primary)] leading-none">{leader.totalResponses}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("totalResponses")}</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold font-mono text-[var(--text-primary)] leading-none">{fmtWait(Math.round(leader.avgWaitSeconds))}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("avgResponseTime")}</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold font-mono text-emerald-500 leading-none">{fmtWait(leader.minWait)}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("fastest")}</p>
              </div>
              <div className="text-center">
                <p className={`text-base font-bold font-mono leading-none ${leader.maxWait > 300 ? "text-[var(--status-danger)]" : "text-amber-500"}`}>{fmtWait(leader.maxWait)}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("slowest")}</p>
              </div>
            </div>

            {/* Effectiveness score */}
            <div className="text-center">
              <div className={`flex h-9 w-9 items-center justify-center rounded-[6px] border font-mono text-xs font-bold ${
                leader.effectivenessScore >= 50 ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-500"
                  : leader.effectivenessScore >= 20 ? "border-amber-400/30 bg-amber-400/10 text-amber-500"
                    : "border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)]"
              }`}>
                {leader.effectivenessScore}
              </div>
              <p className="mt-1 text-[9px] uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("effectivenessScore")}</p>
            </div>

            {/* Daily bar */}
            <div className="hidden lg:block">
              <DailyBar dailyCounts={leader.dailyCounts} />
              <p className="mt-1 text-[9px] uppercase tracking-[0.04em] text-[var(--text-muted)] text-center">{t("responsesPerDay")}</p>
            </div>

            {/* Expand icon */}
            <span
              className={`material-symbols-outlined text-[var(--text-muted)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              style={{ fontSize: 18 }}
            >
              expand_more
            </span>
          </div>
        </div>

        {/* Mobile stats row */}
        <div className="sm:hidden mt-2.5 flex items-center gap-3 text-xs">
          <span className="text-[var(--text-muted)]">{t("totalResponses")}: <strong className="text-[var(--text-primary)] font-mono">{leader.totalResponses}</strong></span>
          <span className="text-[var(--text-muted)]">Avg: <strong className="text-[var(--text-primary)] font-mono">{fmtWait(Math.round(leader.avgWaitSeconds))}</strong></span>
          <span className="text-emerald-500 font-mono font-medium">{fmtWait(leader.minWait)}</span>
          <span className={`font-mono font-medium ${leader.maxWait > 300 ? "text-[var(--status-danger)]" : "text-amber-500"}`}>{fmtWait(leader.maxWait)}</span>
        </div>
      </button>

      {/* Expanded detail table */}
      <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${expanded ? "max-h-[8000px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="border-t border-[var(--border)] px-4 pb-3 pt-3 bg-[var(--surface-subtle)]">
          <DataTable
            columns={[
              { key: "date", label: t("date"), sortable: true, renderCell: (r) => <span className="font-mono text-xs text-[var(--text-secondary)]">{r.date}</span> },
              { key: "設備", label: "設備", sortable: true, renderCell: (r) => <span className="text-xs font-semibold text-[var(--text-primary)]">{r["設備"]}</span> },
              { key: "背番号", label: "背番号", sortable: true, renderCell: (r) => <span className="font-mono text-xs font-medium text-[var(--freya-blue)]">{r["背番号"]}</span> },
              { key: "品番", label: "品番", sortable: true, renderCell: (r) => <span className="text-xs text-[var(--text-secondary)]">{r["品番"]}</span> },
              { key: "Worker_Name", label: t("worker"), sortable: true, renderCell: (r) => <span className="text-xs text-[var(--text-secondary)]">{r.Worker_Name}</span> },
              { key: "calledAt", label: t("calledAt"), sortable: true, renderCell: (r) => <span className="font-mono text-xs text-[var(--text-muted)]">{r.calledAt}</span> },
              { key: "arrivedAt", label: t("arrivedAt"), sortable: true, renderCell: (r) => <span className="font-mono text-xs text-[var(--text-muted)]">{r.arrivedAt}</span> },
              { 
                key: "waitSeconds", 
                label: t("waitTime"), 
                sortable: true, 
                renderCell: (r) => (
                  <span className={`font-mono text-xs font-bold ${r.waitSeconds > 300 ? "text-[var(--status-danger)]" : r.waitSeconds > 120 ? "text-amber-500" : "text-emerald-500"}`}>
                    {fmtWait(r.waitSeconds)}
                  </span>
                ) 
              },
            ]}
            rows={paginatedRecords}
            sort={sort}
            onSort={(colKey) => setSort((prev) => {
              if (prev && prev.column === colKey) {
                if (prev.direction === "asc") return { column: colKey, direction: "desc" };
                return null;
              }
              return { column: colKey, direction: "asc" };
            })}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            filteredCount={totalItems}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            pageSizeOptions={[10, 50, 100]}
            onRowClick={onClickRecord}
            enableColumnReorder={true}
            layoutStorageKey="LeaderboardTableLayout"
            className="w-full overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--surface)]"
            topBarClassName="mb-2 flex flex-wrap items-center justify-end gap-2 px-1"
            bottomBarClassName="flex flex-col gap-2 border-t border-[var(--border)] px-2 pt-2 md:flex-row md:items-center md:justify-between text-xs text-[var(--text-muted)]"
            rowClassName="border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)] cursor-pointer"
            rowsSelectClassName="h-7 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]"
          />
        </div>
      </div>
    </div>
  );
}

export default function StopCallLeaderboard({ leaders, onClickRecord }) {
  const { t } = useLanguage();

  if (!leaders || leaders.length === 0) {
    return (
      <div className="freya-card rounded-[8px] border border-dashed border-[var(--border)] px-6 py-12 text-center text-sm text-[var(--text-muted)] bg-[var(--surface)]">
        <span className="material-symbols-outlined mb-2 block text-[var(--text-muted)]" style={{ fontSize: 36 }}>leaderboard</span>
        <p className="font-semibold text-[var(--text-primary)]">{t("noStopCalls")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leaders.map((leader, idx) => (
        <LeaderCard
          key={leader.leaderUsername || idx}
          leader={leader}
          rank={idx + 1}
          onClickRecord={onClickRecord}
        />
      ))}
    </div>
  );
}
