import { getEquipmentUtilization, sortScheduledProducts } from "../../utils/planner";

export default function PlannerKanbanView({ equipment = [], scheduledProducts = [], breaks = [], onMoveItem, onRemoveItem }) {
  if (!equipment.length) {
    return (
      <div className="rounded-3xl border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-14 text-center text-on-surface-variant">
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
          <section key={equipmentName} className="glass-card flex w-80 flex-shrink-0 flex-col rounded-3xl">
            <div className="border-b border-outline-variant/15 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-on-surface">{equipmentName}</h3>
                  <p className="mt-1 text-xs text-on-surface-variant">{items.length} scheduled item{items.length === 1 ? "" : "s"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${utilization.utilization > 100 ? "bg-error/10 text-error" : "bg-primary/10 text-primary"}`}>
                  {utilization.formattedTime}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div className={`h-full rounded-full ${utilization.utilization > 100 ? "bg-error" : "bg-primary"}`} style={{ width: `${Math.min(utilization.utilization, 100)}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-on-surface-variant">{utilization.utilization}% utilization</div>
            </div>

            <div
              className="min-h-[260px] flex-1 space-y-3 overflow-y-auto px-4 py-4"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const scheduleId = event.dataTransfer.getData("text/planner-item");
                if (scheduleId) onMoveItem(scheduleId, equipmentName);
              }}
            >
              {!items.length ? (
                <div className="rounded-3xl border border-dashed border-outline-variant/20 bg-surface-container-low px-4 py-10 text-center text-sm text-on-surface-variant">
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
                  className="rounded-3xl border border-outline-variant/15 bg-surface-container-low px-4 py-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <h4 className="truncate text-sm font-black text-on-surface">{item.背番号 || item.品番}</h4>
                      </div>
                      <p className="mt-1 truncate text-xs text-on-surface-variant">{item.品名 || item.品番}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-error/10 text-error transition hover:bg-error/15"
                      aria-label={`Remove ${item.背番号}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-on-surface-variant">
                    <div className="rounded-2xl bg-surface px-3 py-2">
                      <div className="font-bold text-on-surface">{item.quantity}</div>
                      <div>pcs</div>
                    </div>
                    <div className="rounded-2xl bg-surface px-3 py-2">
                      <div className="font-bold text-on-surface">{item.boxes}</div>
                      <div>boxes</div>
                    </div>
                    <div className="rounded-2xl bg-surface px-3 py-2">
                      <div className="font-bold text-on-surface">{item.startTime}</div>
                      <div>{item.estimatedTime?.formattedTime}</div>
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