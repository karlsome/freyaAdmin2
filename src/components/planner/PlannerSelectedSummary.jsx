import { useState } from "react";
import EmptyState from "../EmptyState";

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
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Selected Products</h3>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
              aria-expanded={!collapsed}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {collapsed ? "unfold_more" : "unfold_less"}
              </span>
              {collapsed ? "Expand" : "Collapse"}
            </button>
          </div>
          {!collapsed ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">Review scheduled products by equipment before switching views.</p>
          ) : null}
        </div>

        {!collapsed ? (
          <div className="flex w-full flex-col gap-2.5 lg:w-auto lg:min-w-[360px]">
            <div className="flex h-9 items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 focus-within:border-[var(--freya-blue)] focus-within:ring-1 focus-within:ring-[var(--freya-blue)]">
              <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>search</span>
              <input
                type="text"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search selected products…"
                className="h-full flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onClearAll}
              disabled={!scheduledProducts.length}
              className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 px-3 py-1.5 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger)]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear All Scheduled Products
            </button>
          </div>
        ) : null}
      </div>

      {collapsed ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {collapsedSummary.map((item) => (
            <div key={item.label} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{item.label}</div>
              <div className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {!collapsed && !scheduledProducts.length ? (
        <EmptyState className="mt-5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] py-10 text-xs text-[var(--text-muted)]">No products scheduled yet.</EmptyState>
      ) : null}

      {!collapsed && scheduledProducts.length ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Products</div>
              <div className="mt-1 text-lg font-bold text-[var(--text-primary)]">{scheduledProducts.length}</div>
            </div>
            <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Equipment</div>
              <div className="mt-1 text-lg font-bold text-[var(--text-primary)]">{new Set(scheduledProducts.map((item) => item.equipment)).size}</div>
            </div>
            <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Planned Time</div>
              <div className="mt-1 text-lg font-bold text-[var(--text-primary)]">{Math.round(totalSeconds / 60)}m</div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {equipmentNames.length === 0 ? (
              <EmptyState className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-6 text-xs text-[var(--text-muted)]">No scheduled products match the current search.</EmptyState>
            ) : equipmentNames.map((equipment) => {
              const items = equipmentMap[equipment];
              const firstStart = Math.min(...items.map((item) => Number(item.startTime?.split(":")[0]) * 60 + Number(item.startTime?.split(":")[1])));
              const lastEnd = Math.max(...items.map((item) => getScheduledSpan(item, breaks).endTime));
              const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
              const { utilization, formattedTime } = getEquipmentUtilization(scheduledProducts, equipment, breaks);
              const workMinutes = getEffectiveWorkMinutes(breaks, equipment);

              return (
                <section key={equipment} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--text-primary)]">{equipment}</h4>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {items.length} item{items.length === 1 ? "" : "s"} · {totalQuantity} pcs · {minutesToTime(firstStart)} - {minutesToTime(lastEnd)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`rounded-[6px] border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] ${utilization > 100 ? "border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)]" : "border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]"}`}>
                        {formattedTime} · {utilization}%
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">Daily capacity {workMinutes} min</div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {items.map((item) => (
                      <div key={item._scheduleId} className="flex items-center justify-between gap-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 hover:bg-[var(--surface-hover)] transition-colors">
                        <div className="min-w-0 flex items-center gap-3">
                          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-[var(--text-primary)]">{item.背番号 || item.品番 || "Product"}</div>
                            <div className="truncate text-xs text-[var(--text-muted)]">{item.品名 || item.品番 || ""}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right text-xs text-[var(--text-muted)]">
                          <div>
                            <div className="font-semibold text-[var(--text-primary)]">{item.quantity} pcs</div>
                            <div>{item.boxes} boxes</div>
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--text-primary)]">{item.startTime}</div>
                            <div>{item.estimatedTime?.formattedTime}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item)}
                            className="rounded-[6px] border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors"
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