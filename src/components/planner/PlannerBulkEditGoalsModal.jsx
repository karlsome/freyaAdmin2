import { useId, useMemo, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PlannerBulkEditGoalsModal({
  open,
  factoryName,
  planDate,
  goals = [],
  busy = false,
  onClose,
  onDeleteSelected,
  onDeleteAll,
  onUpdateTarget,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const searchId = useId();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [editedTargets, setEditedTargets] = useState({});
  const [savingId, setSavingId] = useState(null);

  // Filter goals matching selected factory & planDate
  const factoryGoals = useMemo(() => {
    return goals.filter((g) => g.factory === factoryName && g.date === planDate);
  }, [goals, factoryName, planDate]);

  const filteredGoals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return factoryGoals;
    return factoryGoals.filter((g) =>
      String(g.背番号 || "").toLowerCase().includes(q) ||
      String(g.品番 || "").toLowerCase().includes(q) ||
      String(g.品名 || "").toLowerCase().includes(q)
    );
  }, [factoryGoals, search]);

  const allVisibleSelected = filteredGoals.length > 0 && filteredGoals.every((g) => selectedIds.has(g._id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredGoals.forEach((g) => next.delete(g._id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredGoals.forEach((g) => next.add(g._id));
        return next;
      });
    }
  }

  function toggleSelectOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    const count = selectedIds.size;
    if (!count) return;
    const confirmMsg = isJa
      ? `選択した ${count} 件の生産目標を削除してもよろしいですか？`
      : `Are you sure you want to delete ${count} selected goal(s)?`;
    if (!window.confirm(confirmMsg)) return;

    await onDeleteSelected?.(Array.from(selectedIds));
    setSelectedIds(new Set());
  }

  async function handleDeleteAll() {
    const count = factoryGoals.length;
    if (!count) return;
    const confirmMsg = isJa
      ? `${factoryName} (${planDate}) の全 ${count} 件の生産目標を削除してもよろしいですか？この操作は取り消せません。`
      : `Are you sure you want to delete ALL ${count} goals for ${factoryName} on ${planDate}? This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    await onDeleteAll?.(factoryName, planDate);
    setSelectedIds(new Set());
  }

  async function handleSaveRow(goal) {
    const newTarget = editedTargets[goal._id];
    if (newTarget == null || Number(newTarget) === Number(goal.targetQuantity)) return;
    const num = Number(newTarget);
    if (!(num > 0)) return;

    setSavingId(goal._id);
    try {
      await onUpdateTarget?.(goal._id, num);
      setEditedTargets((prev) => {
        const next = { ...prev };
        delete next[goal._id];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <PlannerModalShell
      open={open}
      title={isJa ? "生産目標の一括編集 / 削除" : "Edit Production Goals"}
      subtitle={isJa ? `${factoryName} · ${planDate} (${factoryGoals.length} 件)` : `${factoryName} · ${planDate} (${factoryGoals.length} goals)`}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      footer={
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">
            {isJa
              ? `${selectedIds.size} / ${filteredGoals.length} 件選択中`
              : `${selectedIds.size} of ${filteredGoals.length} selected`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            {isJa ? "閉じる" : "Close"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Controls Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={busy || selectedIds.size === 0}
              className="flex items-center gap-1.5 rounded-[6px] border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
              {isJa ? `選択削除 (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}
            </button>
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={busy || factoryGoals.length === 0}
              className="flex items-center gap-1.5 rounded-[6px] border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_forever</span>
              {isJa ? `全削除 (${factoryGoals.length})` : `Delete All (${factoryGoals.length})`}
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <label htmlFor={searchId} className="sr-only">Search</label>
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: 16 }}>
              search
            </span>
            <input
              id={searchId}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isJa ? "背番号・品番・品名で検索…" : "Search goals…"}
              className="h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
            />
          </div>
        </div>

        {/* Goals Table */}
        <div className="overflow-x-auto rounded-[8px] border border-[var(--border)]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
              <tr>
                <th className="w-10 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label={isJa ? "すべて選択" : "Select all"}
                    className="rounded border-[var(--border)] text-[var(--freya-blue)] focus:ring-0"
                  />
                </th>
                <th className="px-3 py-2.5 font-semibold">{isJa ? "背番号" : "背番号"}</th>
                <th className="px-3 py-2.5 font-semibold">{isJa ? "品番" : "品番"}</th>
                <th className="px-3 py-2.5 font-semibold">{isJa ? "品名" : "品名"}</th>
                <th className="w-28 px-3 py-2.5 text-right font-semibold">{isJa ? "目標数" : "Target Qty"}</th>
                <th className="w-20 px-3 py-2.5 text-right font-semibold">{isJa ? "計画数" : "Scheduled"}</th>
                <th className="w-20 px-3 py-2.5 text-right font-semibold">{isJa ? "残数" : "Remaining"}</th>
                <th className="w-24 px-3 py-2.5 text-center font-semibold">{isJa ? "状態" : "Status"}</th>
                <th className="w-20 px-3 py-2.5 text-center font-semibold">{isJa ? "操作" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]">
              {filteredGoals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                    {isJa ? "該当する生産目標がありません。" : "No matching goals found."}
                  </td>
                </tr>
              ) : (
                filteredGoals.map((goal) => {
                  const isSelected = selectedIds.has(goal._id);
                  const currentTarget = editedTargets[goal._id] ?? goal.targetQuantity;
                  const hasChanges = currentTarget !== "" && Number(currentTarget) !== Number(goal.targetQuantity);
                  const isSaving = savingId === goal._id;

                  return (
                    <tr
                      key={goal._id}
                      className={`hover:bg-[var(--surface-hover)] transition-colors ${isSelected ? "bg-[var(--surface-raised)]" : ""}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(goal._id)}
                          className="rounded border-[var(--border)] text-[var(--freya-blue)] focus:ring-0"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-[var(--freya-blue)]">{goal.背番号 || "—"}</td>
                      <td className="px-3 py-2 font-mono">{goal.品番 || "—"}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] truncate max-w-[160px]" title={goal.品名}>
                        {goal.品名 || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="1"
                          value={currentTarget}
                          onChange={(e) => setEditedTargets((prev) => ({ ...prev, [goal._id]: e.target.value }))}
                          className="h-7 w-24 rounded border border-[var(--border)] bg-[var(--surface-raised)] px-2 text-right text-xs font-mono font-semibold text-[var(--text-primary)] focus:border-[var(--freya-blue)] outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--text-secondary)]">
                        {Number(goal.scheduledQuantity || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--text-primary)]">
                        {Number(goal.remainingQuantity || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase ${
                            goal.status === "completed"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : goal.status === "in-progress"
                                ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {goal.status || "pending"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {hasChanges ? (
                          <button
                            type="button"
                            onClick={() => handleSaveRow(goal)}
                            disabled={isSaving}
                            className="rounded bg-[var(--freya-blue)] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors"
                          >
                            {isSaving ? "..." : (isJa ? "保存" : "Save")}
                          </button>
                        ) : (
                          <span className="text-[11px] text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PlannerModalShell>
  );
}
