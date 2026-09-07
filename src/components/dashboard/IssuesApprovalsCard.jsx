import { useState } from "react";

export default function IssuesApprovalsCard({ issues = [], recent = [], onRecordClick, onAskAI, isHighlighted }) {
  const [activeTab, setActiveTab] = useState("issues");

  return (
    <div
      className={`rounded-[8px] bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 shadow-2xs ${
        isHighlighted ? "ring-2 ring-[var(--freya-blue)] ring-offset-2 ring-offset-[var(--page-bg)]" : ""
      }`}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>task_alt</span>
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">Issues & Submissions</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Live trouble tickets, bottlenecks & approvals</p>
          </div>
        </div>

        {onAskAI && (
          <button
            onClick={() => onAskAI("Summarize open maintenance tickets and line stoppages")}
            title="Ask AI to summarize issues"
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--freya-blue)] hover:bg-[var(--freya-blue-subtle)] px-2.5 py-1 rounded-[6px] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
            <span>Ask AI</span>
          </button>
        )}
      </div>

      {/* ── Sub-tabs (Segmented Control) ── */}
      <div className="inline-flex p-1 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] gap-1 mb-3">
        <button
          onClick={() => setActiveTab("issues")}
          className={`h-7 px-3 text-xs font-semibold rounded-[4px] transition-all flex items-center gap-1.5 ${
            activeTab === "issues"
              ? "bg-[var(--freya-blue)] text-white shadow-xs"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/70"
          }`}
        >
          <span>Troubles & Stoppages</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === "issues" ? "bg-white/20 text-white" : "bg-[var(--surface)] text-[var(--text-muted)]"}`}>
            {issues.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("recent")}
          className={`h-7 px-3 text-xs font-semibold rounded-[4px] transition-all flex items-center gap-1.5 ${
            activeTab === "recent"
              ? "bg-[var(--freya-blue)] text-white shadow-xs"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/70"
          }`}
        >
          <span>Recent Submissions</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === "recent" ? "bg-white/20 text-white" : "bg-[var(--surface)] text-[var(--text-muted)]"}`}>
            {recent.length}
          </span>
        </button>
      </div>

      {/* ── List Content ── */}
      <div className="space-y-2 overflow-y-auto max-h-[260px] pr-1">
        {activeTab === "issues" ? (
          issues.length === 0 ? (
            <div className="p-4 rounded-[6px] bg-[var(--surface-hover)] text-center text-xs text-[var(--text-muted)]">
              ● Zero open trouble tickets or line interruptions.
            </div>
          ) : (
            issues.slice(0, 5).map((r, i) => {
              const hasTrouble = Number(r.Total_Trouble_Hours) > 0;
              const ng = Number(r.SRS_Total_NG) || Number(r.Total_NG) || 0;
              return (
                <div
                  key={r.id || i}
                  onClick={() => onRecordClick && onRecordClick(r, r._process || "Kensa")}
                  className="p-2.5 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] cursor-pointer transition-colors flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {r["品番"] || r.Hinban || "General Record"}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)] font-mono">
                        {r["背番号"] || r.Sebanggo || "—"}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {r["工場"] || "Factory"} · {r._process || "Process"}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    {hasTrouble && (
                      <span className="inline-block text-xs font-semibold text-amber-600 dark:text-amber-400">
                        ▲ {Number(r.Total_Trouble_Hours).toFixed(1)}h stoppage
                      </span>
                    )}
                    {ng > 0 && (
                      <span className="block text-xs font-semibold text-rose-600 dark:text-rose-400">
                        ✕ +{ng} NG
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : (
          recent.slice(0, 5).map((r, i) => (
            <div
              key={r.id || i}
              onClick={() => onRecordClick && onRecordClick(r, r._process || "Kensa")}
              className="p-2.5 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] cursor-pointer transition-colors flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {r["品番"] || r.Hinban || "Batch"}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {r["工場"] || "Facility"} · {r._process || "Process"}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Quantity: <span className="font-semibold text-[var(--text-primary)] freya-tabular">{Number(r.Process_Quantity || r.Total || 0).toLocaleString()}</span>
                </div>
              </div>

              <span className="text-xs text-[var(--text-muted)] font-mono freya-tabular flex-shrink-0">
                {r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="pt-3 border-t border-[var(--border)] mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>Click any row to view full batch details</span>
        <span className="font-semibold text-[var(--freya-blue)]">All Synced</span>
      </div>
    </div>
  );
}
