import { formatDuration, sortScheduledProducts } from "../../utils/planner";
import EmptyState from "../EmptyState";

export default function PlannerTableView({ scheduledProducts = [], onRemoveItem }) {
  const items = sortScheduledProducts(scheduledProducts);
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalBoxes = items.reduce((sum, item) => sum + Number(item.boxes || 0), 0);
  const totalSeconds = items.reduce((sum, item) => sum + Number(item?.estimatedTime?.totalSeconds || 0), 0);

  if (!items.length) {
    return (
      <EmptyState className="rounded-3xl bg-surface-container-low py-14">No products in the current plan.</EmptyState>
    );
  }

  return (
    <div className="glass-card planner-data-text overflow-hidden rounded-3xl">
      <div className="overflow-x-auto">
        <table className="ui-table-data min-w-full">
          <thead className="bg-surface-container-low border-b border-outline-variant/20">
            <tr>
              {[
                "Equipment",
                "背番号",
                "品番",
                "品名",
                "Qty",
                "Boxes",
                "Start",
                "Estimated",
                "Actions",
              ].map((label) => (
                <th key={label} className="ui-table-heading px-4 py-3 text-left text-on-surface-variant">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._scheduleId} className="border-b border-outline-variant/10 transition hover:bg-primary/5">
                <td className="px-4 py-3 font-bold text-on-surface">{item.equipment}</td>
                <td className="px-4 py-3 text-on-surface">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.背番号 || "-"}
                  </div>
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{item.品番 || "-"}</td>
                <td className="px-4 py-3 text-on-surface-variant">{item.品名 || "-"}</td>
                <td className="px-4 py-3 text-on-surface">{item.quantity}</td>
                <td className="px-4 py-3 text-on-surface">{item.boxes}</td>
                <td className="px-4 py-3 text-on-surface">{item.startTime}</td>
                <td className="px-4 py-3 text-on-surface">{item.estimatedTime?.formattedTime || "-"}</td>
                <td className="px-4 py-3 text-on-surface">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item)}
                    className="rounded-xl border border-error/20 bg-error/5 px-3 py-2 text-xs font-bold text-error transition hover:bg-error/10"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface-container-low border-t border-outline-variant/20">
            <tr>
              <td colSpan={4} className="px-4 py-3 font-black text-on-surface">Totals</td>
              <td className="px-4 py-3 font-black text-on-surface">{totalQuantity}</td>
              <td className="px-4 py-3 font-black text-on-surface">{totalBoxes}</td>
              <td className="px-4 py-3 font-black text-on-surface">—</td>
              <td className="px-4 py-3 font-black text-on-surface">{formatDuration(totalSeconds)}</td>
              <td className="px-4 py-3 font-black text-on-surface">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}