import { useState } from "react";

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
  const [collapsed, setCollapsed] = useState(true);
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
  const totalBoxes = sortedItems.reduce((sum, item) => sum + (Number(item.boxes) || 0), 0);
  const totalMachines = new Set(
    sortedItems.map((item) => String(item.equipment || "").trim()).filter(Boolean)
  ).size;
  const totalUniqueSebanggo = new Set(
    sortedItems.map((item) => String(item.背番号 || "").trim()).filter(Boolean)
  ).size;

  const collapsedSummary = [
    { label: "Unique 背番号", value: totalUniqueSebanggo },
    { label: "Total Boxes", value: totalBoxes },
    { label: "Total Machines", value: totalMachines },
  ];

  return (
    <div className="glass-card rounded-3xl p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-black text-on-surface">Selected Products</h3>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="planner-data-text inline-flex items-center gap-1 rounded-full border border-outline-variant/20 bg-surface-container px-3 py-1.5 font-bold text-on-surface transition hover:bg-surface-container-high"
              aria-expanded={!collapsed}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {collapsed ? "unfold_more" : "unfold_less"}
              </span>
              {collapsed ? "Expand" : "Collapse"}
            </button>
          </div>
          {!collapsed ? (
            <p className="mt-1 text-sm text-on-surface-variant">Review scheduled products by equipment before switching views.</p>
          ) : null}
        </div>

        {!collapsed ? (
          <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[360px]">
            <div className="ui-control-surface flex h-11 items-center gap-3 rounded-2xl border border-outline-variant/20 px-4">
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>search</span>
              <input
                type="text"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search selected products…"
                className="planner-data-text h-full flex-1 bg-transparent outline-none"
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
        ) : null}
      </div>

      {collapsed ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {collapsedSummary.map((item) => (
            <div key={item.label} className="rounded-full border border-outline-variant/15 bg-surface-container-low px-3 py-2">
              <div className="planner-data-label text-outline">{item.label}</div>
              <div className="planner-data-text mt-1 font-bold text-on-surface">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {!collapsed && !scheduledProducts.length ? (
        <div className="planner-data-text mt-5 rounded-3xl border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-10 text-center text-on-surface-variant">
          No products scheduled yet.
        </div>
      ) : null}

      {!collapsed && scheduledProducts.length ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
              <div className="planner-data-label text-outline">Products</div>
              <div className="planner-data-text mt-2 font-bold text-on-surface">{scheduledProducts.length}</div>
            </div>
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
              <div className="planner-data-label text-outline">Equipment</div>
              <div className="planner-data-text mt-2 font-bold text-on-surface">{new Set(scheduledProducts.map((item) => item.equipment)).size}</div>
            </div>
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
              <div className="planner-data-label text-outline">Planned Time</div>
              <div className="planner-data-text mt-2 font-bold text-on-surface">{Math.round(totalSeconds / 60)}m</div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {equipmentNames.length === 0 ? (
              <div className="planner-data-text rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-low px-4 py-6 text-center text-on-surface-variant">
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
                      <h4 className="planner-data-text font-bold text-on-surface">{equipment}</h4>
                      <p className="planner-data-text mt-1 text-on-surface-variant">
                        {items.length} item{items.length === 1 ? "" : "s"} · {totalQuantity} pcs · {minutesToTime(firstStart)} - {minutesToTime(lastEnd)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${utilization > 100 ? "bg-error/10 text-error" : "bg-primary/10 text-primary"}`}>
                        {formattedTime} · {utilization}%
                      </div>
                      <div className="planner-data-text text-outline">Daily capacity {workMinutes} min</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {items.map((item) => (
                      <div key={item._scheduleId} className="planner-data-text flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
                        <div className="min-w-0 flex items-center gap-3">
                          <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                          <div className="min-w-0">
                            <div className="truncate font-bold text-on-surface">{item.背番号 || item.品番 || "Product"}</div>
                            <div className="truncate text-on-surface-variant">{item.品名 || item.品番 || ""}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right text-on-surface-variant">
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
      ) : null}
    </div>
  );
}