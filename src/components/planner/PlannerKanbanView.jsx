import { getEquipmentUtilization, sortScheduledProducts } from "../../utils/planner";

export default function PlannerKanbanView({ equipment = [], scheduledProducts = [], breaks = [], onMoveItem, onRemoveItem }) {
  if (!equipment.length) {
    return (
      <div className="rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-14 text-center text-xs text-[var(--text-muted)]">
        Choose a factory to open the equipment board.
      </div>
    );
  }

  const orderedProducts = sortScheduledProducts(scheduledProducts);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {equipment.map((equipmentName) => {
        const items = orderedProducts.filter((item) => item.equipment === equipmentName);
        const utilization = getEquipmentUtilization(scheduledProducts, equipmentName, breaks);

        return (
          <section key={equipmentName} className="freya-card flex w-80 flex-shrink-0 flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="border-b border-[var(--border)] px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">{equipmentName}</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{items.length} scheduled item{items.length === 1 ? "" : "s"}</p>
                </div>
                <span className={`rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${utilization.utilization > 100 ? "border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)]" : "border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]"}`}>
                  {utilization.formattedTime}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                <div className={`h-full rounded-full ${utilization.utilization > 100 ? "bg-[var(--status-danger)]" : "bg-[var(--freya-blue)]"}`} style={{ width: `${Math.min(utilization.utilization, 100)}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-[var(--text-muted)]">{utilization.utilization}% utilization</div>
            </div>

            <div
              className="min-h-[260px] flex-1 space-y-2.5 overflow-y-auto p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const scheduleId = event.dataTransfer.getData("text/planner-item");
                if (scheduleId) onMoveItem(scheduleId, equipmentName);
              }}
            >
              {!items.length ? (
                <div className="rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-10 text-center text-xs text-[var(--text-muted)]">
                  Drop products here.
                </div>
              ) : items.map((item) => (
                <article
                  key={item._scheduleId}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/planner-item", item._scheduleId);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 shadow-sm hover:border-[var(--border-strong)] transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <h4 className="truncate text-xs font-semibold text-[var(--text-primary)]">{item.背番号 || item.品番}</h4>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{item.品名 || item.品番}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item)}
                      className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors"
                      aria-label={`Remove ${item.背番号}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                    </button>
                  </div>

                  <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-xs text-[var(--text-muted)]">
                    <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-center">
                      <div className="font-semibold text-xs text-[var(--text-primary)]">{item.quantity}</div>
                      <div className="text-[10px]">pcs</div>
                    </div>
                    <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-center">
                      <div className="font-semibold text-xs text-[var(--text-primary)]">{item.boxes}</div>
                      <div className="text-[10px]">boxes</div>
                    </div>
                    <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-center">
                      <div className="font-semibold text-xs text-[var(--text-primary)]">{item.startTime}</div>
                      <div className="text-[10px]">{item.estimatedTime?.formattedTime}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}