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
    ? "bg-primary/15 text-primary"
    : role === "班長"
      ? "bg-amber-400/15 text-amber-500"
      : "bg-emerald-400/15 text-emerald-400";

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
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
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
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
          className="w-2 rounded-sm bg-primary/60 transition-all hover:bg-primary"
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
  const isTop3 = rank <= 3;

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
    ? "border-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.08)]"
    : rank === 2
      ? "border-slate-300/30 dark:border-slate-400/20"
      : rank === 3
        ? "border-orange-400/25"
        : "border-transparent";

  return (
    <div className={`glass-card rounded-2xl border transition-all duration-300 ${accentBorder} ${isTop3 ? "ring-1 ring-primary/10" : ""}`}>
      <button
        type="button"
        className="w-full text-left p-5"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-4">
          <RankBadge rank={rank} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-on-surface truncate">{leader.leaderName}</span>
              <RoleBadge role={leader.leaderRole} />
            </div>
            <p className="mt-0.5 text-[11px] text-on-surface-variant">@{leader.leaderUsername}</p>
          </div>

          <div className="flex items-center gap-5 flex-shrink-0">
            {/* Stats */}
            <div className="hidden sm:flex items-center gap-5">
              <div className="text-center">
                <p className="text-lg font-bold text-on-surface leading-none">{leader.totalResponses}</p>
                <p className="mt-1 text-[10px] text-on-surface-variant">{t("totalResponses")}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-on-surface leading-none">{fmtWait(Math.round(leader.avgWaitSeconds))}</p>
                <p className="mt-1 text-[10px] text-on-surface-variant">{t("avgResponseTime")}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-400 leading-none">{fmtWait(leader.minWait)}</p>
                <p className="mt-1 text-[10px] text-on-surface-variant">{t("fastest")}</p>
              </div>
              <div className="text-center">
                <p className={`text-lg font-bold leading-none ${leader.maxWait > 300 ? "text-error" : "text-amber-400"}`}>{fmtWait(leader.maxWait)}</p>
                <p className="mt-1 text-[10px] text-on-surface-variant">{t("slowest")}</p>
              </div>
            </div>

            {/* Effectiveness score */}
            <div className="text-center">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold ${
                leader.effectivenessScore >= 50 ? "bg-emerald-400/15 text-emerald-400"
                  : leader.effectivenessScore >= 20 ? "bg-amber-400/15 text-amber-400"
                    : "bg-error/15 text-error"
              }`}>
                {leader.effectivenessScore}
              </div>
              <p className="mt-1 text-[9px] text-on-surface-variant">{t("effectivenessScore")}</p>
            </div>

            {/* Daily bar */}
            <div className="hidden lg:block">
              <DailyBar dailyCounts={leader.dailyCounts} />
              <p className="mt-1 text-[9px] text-on-surface-variant text-center">{t("responsesPerDay")}</p>
            </div>

            {/* Expand icon */}
            <span
              className={`material-symbols-outlined text-outline transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
              style={{ fontSize: 18 }}
            >
              expand_more
            </span>
          </div>
        </div>

        {/* Mobile stats row */}
        <div className="sm:hidden mt-3 flex items-center gap-4 text-xs">
          <span className="text-on-surface-variant">{t("totalResponses")}: <strong className="text-on-surface">{leader.totalResponses}</strong></span>
          <span className="text-on-surface-variant">Avg: <strong className="text-on-surface">{fmtWait(Math.round(leader.avgWaitSeconds))}</strong></span>
          <span className="text-emerald-400 font-medium">{fmtWait(leader.minWait)}</span>
          <span className={`font-medium ${leader.maxWait > 300 ? "text-error" : "text-amber-400"}`}>{fmtWait(leader.maxWait)}</span>
        </div>
      </button>

      {/* Expanded detail table */}
      <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${expanded ? "max-h-[8000px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="border-t border-separator/20 px-5 pb-4 pt-3">
          <DataTable
            columns={[
              { key: "date", label: t("date"), sortable: true },
              { key: "設備", label: "設備", sortable: true },
              { key: "背番号", label: "背番号", sortable: true, cellClassName: "font-medium text-primary" },
              { key: "品番", label: "品番", sortable: true },
              { key: "Worker_Name", label: t("worker"), sortable: true, cellClassName: "text-on-surface-variant" },
              { key: "calledAt", label: t("calledAt"), sortable: true, cellClassName: "text-on-surface-variant" },
              { key: "arrivedAt", label: t("arrivedAt"), sortable: true, cellClassName: "text-on-surface-variant" },
              { 
                key: "waitSeconds", 
                label: t("waitTime"), 
                sortable: true, 
                cellClassName: (r) => `font-semibold ${r.waitSeconds > 300 ? "text-error" : r.waitSeconds > 120 ? "text-amber-400" : "text-emerald-400"}`,
                renderCell: (r) => fmtWait(r.waitSeconds) 
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
            className="w-full"
            tableClassName="w-full text-xs"
            headClassName="border-b border-separator/20"
            headerButtonClassName="ui-table-heading inline-flex items-center gap-2 uppercase tracking-wider text-[10px] text-on-surface-variant transition hover:text-on-surface"
            headerCellClassName="pb-2 pr-3 text-left whitespace-nowrap"
            cellClassName="py-2 pr-3 align-top"
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
      <div className="rounded-2xl border border-dashed border-outline-variant/20 px-6 py-12 text-center text-sm text-on-surface-variant">
        <span className="material-symbols-outlined mb-2 block text-outline" style={{ fontSize: 36 }}>leaderboard</span>
        <p className="font-semibold text-on-surface">{t("noStopCalls")}</p>
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
