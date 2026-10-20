import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { readStoredAuthUser } from "../../utils/auth";
import {
  fetchGatekeeperSettings,
  setGatekeeperEnabled,
} from "../../services/scnaApi";

function formatUpdatedAt(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
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
  );
}
