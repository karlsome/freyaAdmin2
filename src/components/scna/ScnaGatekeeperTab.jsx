import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { readStoredAuthUser } from "../../utils/auth";
import {
  fetchGatekeeperSettings,
  fetchPrintRules,
  setGatekeeperEnabled,
  setPrintRequired,
} from "../../services/scnaApi";

function formatUpdatedAt(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

// Tablet machines that print labels; admins can add more (e.g. IT3). Matches the names the tablets use.
const DEFAULT_PRINT_MACHINES = ["Girasol-1", "Girasol-2"];

function PrintRuleCard({ onFlash, isJa }) {
  const [rules, setRules] = useState({});
  const [extra, setExtra] = useState([]);
  const [newMachine, setNewMachine] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPrintRules();
      const map = {};
      rows.forEach((r) => { map[r.machine] = r; });
      setRules(map);
      setExtra(rows.map((r) => r.machine).filter((m) => !DEFAULT_PRINT_MACHINES.includes(m)));
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  }, [onFlash]);

  useEffect(() => {
    load();
  }, [load]);

  const machines = [...DEFAULT_PRINT_MACHINES, ...extra.filter((m) => !DEFAULT_PRINT_MACHINES.includes(m))];

  async function save(machine, printRequired) {
    setSavingKey(machine);
    try {
      const saved = await setPrintRequired({
        factory: "SCNA",
        machine,
        printRequired,
        username: readStoredAuthUser()?.username,
      });
      setRules((prev) => ({ ...prev, [machine]: saved }));
      onFlash?.({
        type: "success",
        message: isJa
          ? `${machine} のラベル印刷を${printRequired ? "必須" : "任意"}にしました（次回のページ読み込み時に反映）`
          : `Label printing ${printRequired ? "required" : "optional"} for ${machine} (applies when the tablet page reloads)`,
      });
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    } finally {
      setSavingKey("");
    }
  }

  function handleAdd() {
    const name = newMachine.trim();
    if (!name) return;
    if (!machines.includes(name)) setExtra((prev) => [...prev, name]);
    setNewMachine("");
  }

  return (
    <div className="freya-card mt-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "ラベル印刷ルール (SRS / 検査)" : "Label Printing Rule (SRS / Kensa)"}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {isJa
              ? "必須の場合、ラベルを印刷せずに送信するにはリーダー承認が必要です。任意の場合は印刷なしで送信できます（プリンター未設置の設備向け）。初期値は必須です。"
              : "Required: submitting without a printed label needs leader approval. Optional: tablets can submit without printing (for equipment with no printer yet). Default is required."}
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="text-xs font-medium text-[var(--freya-blue)] disabled:opacity-50">
          {isJa ? "再読み込み" : "Refresh"}
        </button>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {machines.map((machine) => {
          const required = rules[machine]?.printRequired !== false;
          const saving = savingKey === machine;
          return (
            <div key={machine} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{machine}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {isJa ? "最終更新" : "Last changed"}: {formatUpdatedAt(rules[machine]?.updatedAt)} · {rules[machine]?.updatedBy || "-"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={required}
                disabled={saving}
                onClick={() => save(machine, !required)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  required
                    ? "bg-[var(--status-normal)]/15 text-[var(--status-normal)]"
                    : "bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {required ? "print" : "print_disabled"}
                </span>
                {required ? (isJa ? "必須" : "Required") : isJa ? "任意" : "Optional"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={newMachine}
          onChange={(e) => setNewMachine(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={isJa ? "設備を追加 (例: IT3)" : "Add machine (e.g. IT3)"}
          className="h-8 w-48 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text-primary)]"
        />
        <button type="button" onClick={handleAdd} className="text-xs font-medium text-[var(--freya-blue)]">
          {isJa ? "追加" : "Add"}
        </button>
      </div>
    </div>
  );
}

export default function ScnaGatekeeperTab({ onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchGatekeeperSettings();
      rows.sort((a, b) => String(a.machine).localeCompare(String(b.machine)));
      setSettings(rows);
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  }, [onFlash]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(row) {
    const key = `${row.factory}|${row.machine}`;
    const nextEnabled = !row.enabled;
    setSavingKey(key);
    try {
      const saved = await setGatekeeperEnabled({
        factory: row.factory,
        machine: row.machine,
        enabled: nextEnabled,
        username: readStoredAuthUser()?.username,
      });
      setSettings((prev) =>
        prev.map((r) => (r.factory === row.factory && r.machine === row.machine ? { ...r, ...saved } : r))
      );
      onFlash?.({
        type: "success",
        message: isJa
          ? `${row.machine} のゲートキーパーを${nextEnabled ? "有効" : "無効"}にしました（数秒以内に反映）`
          : `Gatekeeper ${nextEnabled ? "enabled" : "disabled"} for ${row.machine} (applies within a few seconds)`,
      });
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    } finally {
      setSavingKey("");
    }
  }

  return (
    <>
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "ゲートキーパーロック" : "Gatekeeper Lock"}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {isJa
              ? "無効の場合、キャンセル・休憩後に機械はロックされず、再スタートがブロックされません。初期値は無効です。"
              : "When disabled, the machine is not locked after a cancel or break and restarts are never blocked. Disabled by default."}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs font-medium text-[var(--freya-blue)] disabled:opacity-50"
        >
          {isJa ? "再読み込み" : "Refresh"}
        </button>
      </div>

      {settings.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">
          {loading
            ? isJa ? "読み込み中..." : "Loading..."
            : isJa
              ? "設定がありません。各機械のリスナーが起動すると自動的に表示されます。"
              : "No machines yet. Each machine appears here automatically once its listener has started."}
        </p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {settings.map((row) => {
            const key = `${row.factory}|${row.machine}`;
            const saving = savingKey === key;
            return (
              <div key={key} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {row.machine}
                    <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">{row.factory}</span>
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {isJa ? "最終更新" : "Last changed"}: {formatUpdatedAt(row.updatedAt)} · {row.updatedBy || "-"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(row.enabled)}
                  disabled={saving}
                  onClick={() => handleToggle(row)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    row.enabled
                      ? "bg-[var(--status-normal)]/15 text-[var(--status-normal)]"
                      : "bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {row.enabled ? "lock" : "lock_open"}
                  </span>
                  {row.enabled ? (isJa ? "有効" : "Enabled") : isJa ? "無効" : "Disabled"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
    <PrintRuleCard onFlash={onFlash} isJa={isJa} />
    </>
  );
}