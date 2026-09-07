import {
  calculateBoxesNeeded,
  getAssignedEquipmentForGoal,
  getPlannerGoalState,
  groupGoalsByDate,
  sortGoals,
} from "../../utils/planner";

function GoalRow({ goal, currentDate, scheduledProducts, products, productColors, onDeleteGoal, onScheduleGoal }) {
  const goalState = getPlannerGoalState(goal);
  const assignedEquipment = getAssignedEquipmentForGoal(goal, scheduledProducts);
  const capacity = calculateBoxesNeeded(goal, goal.targetQuantity, products);
  const scheduledBoxes = calculateBoxesNeeded(goal, goal.scheduledQuantity, products);
  const targetBoxes = capacity;
  const schedulable = goal.date === currentDate && Number(goal.remainingQuantity || 0) > 0;

  return (
    <article className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
      <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(90px,1fr)_minmax(160px,1.2fr)_minmax(220px,1.8fr)_minmax(200px,1.8fr)_minmax(140px,1.2fr)_minmax(100px,0.9fr)_minmax(90px,0.8fr)_auto] xl:items-center text-xs">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${goalState.dotClassName}`} />
          <div>
            <div className="font-semibold text-[var(--text-primary)] font-mono">{goal.背番号 || "-"}</div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{goalState.label}</div>
          </div>
        </div>

        <div>
          <div className="font-medium text-[var(--text-primary)] font-mono">{goal.品番 || "-"}</div>
          <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: productColors[goal.背番号] }} />
            {goal.date === currentDate ? "Today" : goal.date}
          </div>
        </div>

        <div>
          <div className="truncate font-medium text-[var(--text-primary)]">{goal.品名 || "Unnamed product"}</div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            Remaining: <span className="font-mono freya-tabular font-semibold text-[var(--text-secondary)]">{Number(goal.remainingQuantity || 0)}</span> pcs
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="text-[var(--text-secondary)] font-mono freya-tabular">{Number(goal.scheduledQuantity || 0)} / {Number(goal.targetQuantity || 0)} pcs</span>
            <span className={`font-mono font-semibold ${goalState.textClassName}`}>{goalState.percentage}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--surface-subtle)] overflow-hidden">
            <div className={`h-full rounded-full ${goalState.barClassName}`} style={{ width: `${goalState.percentage}%` }} />
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Assigned</div>
          <div className="mt-0.5 font-semibold text-[var(--freya-blue)]">
            {assignedEquipment.length ? assignedEquipment.join(", ") : "Not scheduled"}
          </div>
        </div>

        <div className="text-[var(--text-primary)] xl:text-right">
          <div className="font-semibold font-mono freya-tabular">{scheduledBoxes}/{targetBoxes}</div>
          <div className="text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">Boxes</div>
        </div>

        <div className="text-[var(--text-primary)] xl:text-right">
          <div className={`font-semibold text-xs ${goalState.textClassName}`}>{goalState.label}</div>
          <div className="text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">State</div>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onScheduleGoal(goal)}
            disabled={!schedulable}
            className="rounded-[6px] bg-[var(--freya-blue)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-40 transition-colors shadow-none"
          >
            Plan
          </button>
          <button
            type="button"
            onClick={() => onDeleteGoal(goal)}
            className="rounded-[6px] border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors shadow-none"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export default function PlannerGoalList({
  goals = [],
  currentDate,
  scheduledProducts = [],
  products = [],
  productColors = {},
  onDeleteGoal,
  onScheduleGoal,
}) {
  const sortedGoals = sortGoals(goals);
  const goalsByDate = groupGoalsByDate(sortedGoals);
  const dateGroups = Object.keys(goalsByDate).sort((left, right) => left.localeCompare(right));

  if (!sortedGoals.length) {
    return (
      <div className="freya-card rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center text-[var(--text-muted)]">
        <span className="material-symbols-outlined text-3xl text-[var(--freya-blue)] mb-2">target</span>
        <p className="text-base font-semibold text-[var(--text-primary)]">No goals loaded</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Upload a CSV or add goals manually to start planning production.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dateGroups.map((date) => (
        <section key={date}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{date}</div>
            {date === currentDate ? (
              <span className="rounded-[4px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--freya-blue)]">Today</span>
            ) : null}
          </div>
          <div className="space-y-2">
            {goalsByDate[date].map((goal) => (
              <GoalRow
                key={goal._id}
                goal={goal}
                currentDate={currentDate}
                scheduledProducts={scheduledProducts}
                products={products}
                productColors={productColors}
                onDeleteGoal={onDeleteGoal}
                onScheduleGoal={onScheduleGoal}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}