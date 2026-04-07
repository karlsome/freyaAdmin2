import {
  getEffectiveWorkMinutes,
  getEquipmentUtilization,
  getScheduledSpan,
  minutesToTime,
  sortScheduledProducts,
} from "../../utils/planner";

export default function PlannerSelectedSummary({
  scheduledProducts = [],
  breaks = [],
  searchValue,
  onSearchChange,
  onRemoveItem,
  onClearAll,
}) {
  const sortedItems = sortScheduledProducts(scheduledProducts);
  const filteredItems = searchValue
    ? sortedItems.filter((item) => {
        const search = searchValue.toLowerCase();
        return (
          String(item.背番号 || "").toLowerCase().includes(search)
          || String(item.品番 || "").toLowerCase().includes(search)
          || String(item.品名 || "").toLowerCase().includes(search)
        );
      })
    : sortedItems;

  const equipmentMap = filteredItems.reduce((groups, item) => {
    if (!groups[item.equipment]) groups[item.equipment] = [];
    groups[item.equipment].push(item);
    return groups;
  }, {});

  const equipmentNames = Object.keys(equipmentMap).sort((left, right) => left.localeCompare(right, "ja"));
  const totalSeconds = sortedItems.reduce((sum, item) => sum + Number(item?.estimatedTime?.totalSeconds || 0), 0);

  return (
    <div className="glass-card rounded-3xl p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-black text-on-surface">Selected Products</h3>
          <p className="mt-1 text-sm text-on-surface-variant">Review scheduled products by equipment before switching views.</p>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[360px]">
          <div className="ui-control-surface flex h-11 items-center gap-3 rounded-2xl border border-outline-variant/20 px-4">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>search</span>
            <input
              type="text"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search selected products…"
              className="h-full flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onClearAll}
            disabled={!scheduledProducts.length}
            className="rounded-2xl border border-error/20 bg-error/5 px-4 py-2 text-xs font-bold text-error transition hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear All Scheduled Products
          </button>
        </div>
      </div>

      {!scheduledProducts.length ? (
        <div className="mt-5 rounded-3xl border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-10 text-center text-sm text-on-surface-variant">
          No products scheduled yet.
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Products</div>
              <div className="mt-2 text-2xl font-black text-on-surface">{scheduledProducts.length}</div>
            </div>
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Equipment</div>
              <div className="mt-2 text-2xl font-black text-on-surface">{new Set(scheduledProducts.map((item) => item.equipment)).size}</div>
            </div>
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Planned Time</div>
              <div className="mt-2 text-2xl font-black text-on-surface">{Math.round(totalSeconds / 60)}m</div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {equipmentNames.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant">
                No scheduled products match the current search.
              </div>
            ) : equipmentNames.map((equipment) => {
              const items = equipmentMap[equipment];
              const firstStart = Math.min(...items.map((item) => Number(item.startTime?.split(":")[0]) * 60 + Number(item.startTime?.split(":")[1])));
              const lastEnd = Math.max(...items.map((item) => getScheduledSpan(item, breaks).endTime));
              const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
              const { utilization, formattedTime } = getEquipmentUtilization(scheduledProducts, equipment, breaks);
              const workMinutes = getEffectiveWorkMinutes(breaks, equipment);

              return (
                <section key={equipment} className="rounded-3xl border border-outline-variant/15 bg-surface-container-low p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="text-base font-black text-on-surface">{equipment}</h4>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {items.length} item{items.length === 1 ? "" : "s"} · {totalQuantity} pcs · {minutesToTime(firstStart)} - {minutesToTime(lastEnd)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${utilization > 100 ? "bg-error/10 text-error" : "bg-primary/10 text-primary"}`}>
                        {formattedTime} · {utilization}%
                      </div>
                      <div className="text-[11px] text-outline">Daily capacity {workMinutes} min</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {items.map((item) => (
                      <div key={item._scheduleId} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
                        <div className="min-w-0 flex items-center gap-3">
                          <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-on-surface">{item.背番号 || item.品番 || "Product"}</div>
                            <div className="truncate text-[11px] text-on-surface-variant">{item.品名 || item.品番 || ""}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right text-xs text-on-surface-variant">
                          <div>
                            <div className="font-bold text-on-surface">{item.quantity} pcs</div>
                            <div>{item.boxes} boxes</div>
                          </div>
                          <div>
                            <div className="font-bold text-on-surface">{item.startTime}</div>
                            <div>{item.estimatedTime?.formattedTime}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item)}
                            className="rounded-xl border border-error/20 px-3 py-2 text-[11px] font-bold text-error transition hover:bg-error/10"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}