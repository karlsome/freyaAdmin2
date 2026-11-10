import {
  calculateBoxesNeeded,
  getAssignedEquipmentForGoal,
  getPlannerGoalState,
  groupGoalsByDate,
  sortGoals,
} from "../../utils/planner";
import { useLanguage } from "../../contexts/LanguageContext";

function GoalRow({ goal, currentDate, scheduledProducts, products, productColors, produced = null, live = 0, onDeleteGoal, onScheduleGoal, onReconcileSingleGoal }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const goalState = getPlannerGoalState(goal);
  const assignedEquipment = getAssignedEquipmentForGoal(goal, scheduledProducts);
  const capacity = calculateBoxesNeeded(goal, goal.targetQuantity, products);
  const scheduledBoxes = calculateBoxesNeeded(goal, goal.scheduledQuantity, products);
  const targetBoxes = capacity;
  const schedulable = goal.date === currentDate && Number(goal.remainingQuantity || 0) > 0;
  const stateLabel = isJa ? (goalState.labelJa || goalState.label) : goalState.label;

  const actualScheduled = scheduledProducts
    .filter((p) => (p.goalId && p.goalId === goal._id) || (p.背番号 && p.背番号 === goal.背番号))
    .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  const isOutOfSync = goal.date === currentDate && actualScheduled !== Number(goal.scheduledQuantity || 0);

  return (
    <article className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
      <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(90px,1fr)_minmax(160px,1.2fr)_minmax(220px,1.8fr)_minmax(200px,1.8fr)_minmax(140px,1.2fr)_minmax(100px,0.9fr)_minmax(90px,0.8fr)_auto] xl:items-center text-xs">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${goalState.dotClassName}`} />
          <div>
            <div className="font-semibold text-[var(--text-primary)] font-mono">{goal.背番号 || "-"}</div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
              <span>{stateLabel}</span>
              {isOutOfSync && (
                <button
                  type="button"
                  onClick={() => onReconcileSingleGoal?.(goal)}
                  title={isJa ? `計画数(${goal.scheduledQuantity})とタイムライン実数(${actualScheduled})が不一致です。クリックして同期` : `Scheduled (${goal.scheduledQuantity}) doesn't match timeline (${actualScheduled}). Click to reconcile.`}
                  className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>sync_problem</span>
                  {isJa ? "同期ズレ" : "Sync"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="font-medium text-[var(--text-primary)] font-mono">{goal.品番 || "-"}</div>
          <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: productColors[goal.背番号] }} />
            {goal.date === currentDate ? (isJa ? "本日" : "Today") : goal.date}
          </div>
        </div>

        <div>
          <div className="truncate font-medium text-[var(--text-primary)]">{goal.品名 || (isJa ? "品名未設定" : "Unnamed product")}</div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {isJa ? "残数量:" : "Remaining:"} <span className="font-mono freya-tabular font-semibold text-[var(--text-secondary)]">{Number(goal.remainingQuantity || 0)}</span> {isJa ? "個" : "pcs"}
          </div>
        </div>

        <div
          title={isJa
            ? "目標数のうち、スケジュールに配置済みの割合です。生産の進捗ではありません。"
            : "Share of the target already placed on the schedule. This is not production progress."}
        >
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--freya-blue)]">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>event_available</span>
              {Number(goal.scheduledQuantity || 0) >= Number(goal.targetQuantity || 0) && Number(goal.targetQuantity || 0) > 0
                ? (isJa ? "全て計画済み" : "Fully scheduled")
                : (isJa ? "計画済み" : "Scheduled")}
            </span>
            <span className="font-mono font-semibold text-[var(--freya-blue)]">{goalState.percentage}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--surface-subtle)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--freya-blue)]" style={{ width: `${goalState.percentage}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-secondary)] font-mono freya-tabular">
            {Number(goal.scheduledQuantity || 0)} / {Number(goal.targetQuantity || 0)} {isJa ? "個" : "pcs"}
          </div>
          {produced !== null ? (
            <div
              className="mt-2"
              title={isJa
                ? "作業者が提出済みの良品数に、稼働中の設備のサイクル数から推定した未提出分（推定）を加えた数です。"
                : "Good pieces submitted by workers, plus an estimate for work still running (machine cycles x pcs per cycle, minus live NG)."}
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>precision_manufacturing</span>
                  {isJa ? "生産済み" : "Produced"}
                </span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {Number(goal.targetQuantity || 0) > 0 ? Math.round((produced / Number(goal.targetQuantity)) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--surface-subtle)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, Number(goal.targetQuantity || 0) > 0 ? (produced / Number(goal.targetQuantity)) * 100 : 0)}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-secondary)] font-mono freya-tabular">
                {produced} / {Number(goal.targetQuantity || 0)} {isJa ? "個" : "pcs"}
                {live > 0 ? (
                  <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                    ({isJa ? `稼働中 約${live}個を含む` : `incl. ~${live} running now`})
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            {isJa ? "割当設備" : "Assigned"}
          </div>
          <div className="mt-0.5 font-semibold text-[var(--freya-blue)]">
            {assignedEquipment.length ? assignedEquipment.join(", ") : (isJa ? "未計画" : "Not scheduled")}
          </div>
        </div>

        <div className="text-[var(--text-primary)] xl:text-right">
          <div className="font-semibold font-mono freya-tabular">{scheduledBoxes}/{targetBoxes}</div>
          <div className="text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
            {isJa ? "箱数" : "Boxes"}
          </div>
        </div>

        <div className="text-[var(--text-primary)] xl:text-right">
          <div className={`font-semibold text-xs ${goalState.textClassName}`}>{stateLabel}</div>
          <div className="text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
            {isJa ? "状態" : "State"}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onScheduleGoal(goal)}
            disabled={!schedulable}
            className="rounded-[6px] bg-[var(--freya-blue)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-40 transition-colors shadow-none"
          >
            {isJa ? "計画" : "Plan"}
          </button>
          <button
            type="button"
            onClick={() => onDeleteGoal(goal)}
            className="rounded-[6px] border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors shadow-none"
          >
            {isJa ? "削除" : "Delete"}
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
  producedBySerial = {},
  products = [],
  productColors = {},
  onDeleteGoal,
  onScheduleGoal,
  onReconcileSingleGoal,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const sortedGoals = sortGoals(goals);
  const goalsByDate = groupGoalsByDate(sortedGoals);
  const dateGroups = Object.keys(goalsByDate).sort((left, right) => left.localeCompare(right));

  // Submitted production only exists for the plan date. When one 背番号 has several goals that day, fill the goals in
  // list order up to their target; whatever is left over goes to the last one.
  const producedByGoal = {};
  const liveByGoal = {};
  const leftover = {};
  Object.entries(producedBySerial).forEach(([serial, entry]) => { leftover[serial] = entry.good || 0; });
  const todaysGoals = (goalsByDate[currentDate] || []).filter((goal) => goal.背番号);
  todaysGoals.forEach((goal, index) => {
    const serial = goal.背番号;
    const isLastForSerial = !todaysGoals.slice(index + 1).some((other) => other.背番号 === serial);
    const left = leftover[serial] || 0;
    const take = isLastForSerial ? left : Math.min(left, Number(goal.targetQuantity || 0));
    // Pieces still running (not submitted yet) belong to the last goal of that 背番号
    const live = isLastForSerial ? Math.round(producedBySerial[serial]?.live || 0) : 0;
    producedByGoal[goal._id] = take + live;
    liveByGoal[goal._id] = live;
    leftover[serial] = left - take;
  });

  if (!sortedGoals.length) {
    return (
      <div className="freya-card rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center text-[var(--text-muted)]">
        <span className="material-symbols-outlined text-3xl text-[var(--freya-blue)] mb-2">target</span>
        <p className="text-base font-semibold text-[var(--text-primary)]">
          {isJa ? "目標が読み込まれていません" : "No goals loaded"}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {isJa ? "CSVをアップロードするか手動入力で生産目標を追加してください。" : "Upload a CSV or add goals manually to start planning production."}
        </p>
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
              <span className="rounded-[4px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--freya-blue)]">
                {isJa ? "本日" : "Today"}
              </span>
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
                produced={goal.date === currentDate ? (producedByGoal[goal._id] ?? 0) : null}
                live={goal.date === currentDate ? (liveByGoal[goal._id] ?? 0) : 0}
                onDeleteGoal={onDeleteGoal}
                onScheduleGoal={onScheduleGoal}
                onReconcileSingleGoal={onReconcileSingleGoal}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}