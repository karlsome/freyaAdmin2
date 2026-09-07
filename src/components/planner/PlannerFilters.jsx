export default function PlannerFilters({
  factories = [],
  factoryName,
  planDate,
  endDate,
  loading,
  onFactoryChange,
  onDateChange,
  onEndDateChange,
}) {
  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Factory</label>
          <select
            value={factoryName}
            onChange={(event) => onFactoryChange(event.target.value)}
            className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
          >
            <option value="">Select factory…</option>
            {factories.map((factory) => (
              <option key={factory} value={factory}>{factory}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Plan Date</label>
          <input
            type="date"
            value={planDate}
            onChange={(event) => onDateChange(event.target.value)}
            className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
          />
        </div>

        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Planner State</div>
              <div className="mt-0.5 font-medium text-xs text-[var(--text-primary)]">
                {loading ? "Refreshing schedule data…" : factoryName ? "Ready for scheduling" : "Select a factory to begin"}
              </div>
            </div>
            {loading ? (
              <span className="material-symbols-outlined animate-spin text-[var(--freya-blue)]" style={{ fontSize: 18 }}>progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 18 }}>event_note</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}