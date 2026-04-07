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
    <div className="glass-card planner-data-text rounded-3xl p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
        <div className="flex flex-col gap-1.5">
          <label className="planner-data-label text-outline">Factory</label>
          <select
            value={factoryName}
            onChange={(event) => onFactoryChange(event.target.value)}
            className="planner-data-text h-11 rounded-2xl border border-outline-variant/20 px-4 outline-none transition focus:border-primary/40"
          >
            <option value="">Select factory…</option>
            {factories.map((factory) => (
              <option key={factory} value={factory}>{factory}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="planner-data-label text-outline">Plan Date</label>
          <input
            type="date"
            value={planDate}
            onChange={(event) => onDateChange(event.target.value)}
            className="planner-data-text h-11 rounded-2xl border border-outline-variant/20 px-4 outline-none transition focus:border-primary/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="planner-data-label text-outline">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="planner-data-text h-11 rounded-2xl border border-outline-variant/20 px-4 outline-none transition focus:border-primary/40"
          />
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-on-surface-variant">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="planner-data-label text-outline">Planner State</div>
              <div className="mt-1 font-medium text-on-surface">
                {loading ? "Refreshing schedule data…" : factoryName ? "Ready for scheduling" : "Select a factory to begin"}
              </div>
            </div>
            {loading ? (
              <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-primary">event_note</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}