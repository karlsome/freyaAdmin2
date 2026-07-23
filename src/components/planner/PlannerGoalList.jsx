import { useLanguage } from "../../contexts/LanguageContext";
import {
  calculateBoxesNeeded,
  getAssignedEquipmentForGoal,
  getPlannerGoalState,
  groupGoalsByDate,
  sortGoals,
} from "../../utils/planner";

function GoalRow({ goal, currentDate, scheduledProducts, products, productColors, onDeleteGoal, onScheduleGoal }) {
  const { t } = useLanguage();
  const goalState = getPlannerGoalState(goal);
  const assignedEquipment = getAssignedEquipmentForGoal(goal, scheduledProducts);
  const capacity = calculateBoxesNeeded(goal, goal.targetQuantity, products);
  const scheduledBoxes = calculateBoxesNeeded(goal, goal.scheduledQuantity, products);
  const targetBoxes = capacity;
  const schedulable = goal.date === currentDate && Number(goal.remainingQuantity || 0) > 0;

  return (
    <article className={`planner-data-text rounded-2xl border p-4 ${goalState.surfaceClassName}`}>
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(90px,1fr)_minmax(160px,1.2fr)_minmax(220px,1.8fr)_minmax(220px,1.8fr)_minmax(140px,1.2fr)_minmax(120px,0.9fr)_minmax(96px,0.8fr)_auto] xl:items-center">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${goalState.dotClassName}`} />
          <div>
            <div className="font-semibold text-on-surface">{goal.背番号 || "-"}</div>
            <div className="text-outline">{goalState.label}</div>
          </div>
        </div>

        <div>
          <div className="font-semibold text-on-surface">{goal.品番 || "-"}</div>
          <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-semibold text-on-surface-variant">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: productColors[goal.背番号] }} />
            {goal.date === currentDate ? "Current day" : goal.date}
          </div>
        </div>

        <div>
          <div className="truncate font-medium text-on-surface">{goal.品名 || "Unnamed product"}</div>
          <div className="mt-1 text-on-surface-variant">
            Remaining {Number(goal.remainingQuantity || 0)} pcs
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3 font-medium">
            <span className="text-on-surface">{Number(goal.scheduledQuantity || 0)} / {Number(goal.targetQuantity || 0)} pcs</span>
            <span className={goalState.textClassName}>{goalState.percentage}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
            <div className={`h-full rounded-full ${goalState.barClassName}`} style={{ width: `${goalState.percentage}%` }} />
          </div>
        </div>

        <div>
          <div className="planner-data-label text-outline">{t("assigned")}</div>
          <div className="mt-1 font-semibold text-primary">
            {assignedEquipment.length ? assignedEquipment.join(", ") : "Not scheduled"}
          </div>
        </div>

        <div className="text-on-surface xl:text-right">
          <div className="font-semibold">{scheduledBoxes}/{targetBoxes}</div>
          <div className="planner-data-label text-outline">{t("boxes")}</div>
        </div>

        <div className="text-on-surface xl:text-right">
          <div className={`font-semibold ${goalState.textClassName}`}>{goalState.label}</div>
          <div className="planner-data-label text-outline">{t("state")}</div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onScheduleGoal(goal)}
            disabled={!schedulable}
            className="rounded-xl border border-outline-variant/20 px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
          >
            Plan
          </button>
          <button
            type="button"
            onClick={() => onDeleteGoal(goal)}
            className="rounded-xl border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold text-error transition hover:bg-error/10"
          >{t("delete")}</button>
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
  const { t } = useLanguage();
  const sortedGoals = sortGoals(goals);
  const goalsByDate = groupGoalsByDate(sortedGoals);
  const dateGroups = Object.keys(goalsByDate).sort((left, right) => left.localeCompare(right));

  if (!sortedGoals.length) {
    return (
      <div className="rounded-3xl border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-14 text-center text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl text-primary/60">target</span>
        <p className="mt-3 text-lg font-semibold text-on-surface">{t("noGoalsLoaded")}</p>
        <p className="mt-1 text-sm">{t("uploadCsvOrAddManual")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {dateGroups.map((date) => (
        <section key={date}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="planner-data-label text-outline">{date}</div>
            {date === currentDate ? (
              <span className="rounded-full bg-primary/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{t("today")}</span>
            ) : null}
          </div>
          <div className="space-y-3">
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