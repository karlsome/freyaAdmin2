import { formatDuration, sortScheduledProducts } from "../../utils/planner";
import EmptyState from "../EmptyState";

export default function PlannerTableView({ scheduledProducts = [], onRemoveItem }) {
  const items = sortScheduledProducts(scheduledProducts);
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalBoxes = items.reduce((sum, item) => sum + Number(item.boxes || 0), 0);
  const totalSeconds = items.reduce((sum, item) => sum + Number(item?.estimatedTime?.totalSeconds || 0), 0);

  if (!items.length) {
    return (
      <EmptyState className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] py-14 text-xs text-[var(--text-muted)]">No products in the current plan.</EmptyState>
    );
  }

  return (
    <div className="freya-card overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
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
                <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._scheduleId} className="border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)]">
                <td className="px-4 py-3 text-xs font-semibold text-[var(--text-primary)]">{item.equipment}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-primary)]">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.背番号 || "-"}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{item.品番 || "-"}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{item.品名 || "-"}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-primary)]">{item.quantity}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-primary)]">{item.boxes}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-primary)]">{item.startTime}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-primary)]">{item.estimatedTime?.formattedTime || "-"}</td>
                <td className="px-4 py-3 text-xs">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item)}
                    className="rounded-[6px] border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-[var(--border)] bg-[var(--surface-subtle)]">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-[var(--text-primary)]">Totals</td>
              <td className="px-4 py-3 text-xs font-semibold text-[var(--text-primary)]">{totalQuantity}</td>
              <td className="px-4 py-3 text-xs font-semibold text-[var(--text-primary)]">{totalBoxes}</td>
              <td className="px-4 py-3 text-xs font-semibold text-[var(--text-primary)]">—</td>
              <td className="px-4 py-3 text-xs font-semibold text-[var(--text-primary)]">{formatDuration(totalSeconds)}</td>
              <td className="px-4 py-3 text-xs font-semibold text-[var(--text-primary)]">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}