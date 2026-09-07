import ModalShell from "./ModalShell";
import { useLanguage } from "../contexts/LanguageContext";

function fmtWait(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function InfoRow({ label, value, accent }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-[var(--border)]/40 last:border-0">
      <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-right ${accent || "text-[var(--text-primary)]"}`}>{value ?? "—"}</span>
    </div>
  );
}

function RoleBadge({ role }) {
  const color = role === "admin"
    ? "border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]"
    : role === "班長"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-500"
      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-500";

  return (
    <span className={`inline-block rounded-[4px] border px-1.5 py-0.5 text-[10px] font-mono font-medium ${color}`}>
      {role}
    </span>
  );
}

export default function StopCallDetailModal({ open, onClose, record, stopCallEntry, allStopCalls }) {
  const { t } = useLanguage();

  if (!open || !record) return null;

  const totalNg = Number(record.SRS_Total_NG) || Number(record.Total_NG) || 0;
  const defectRate = record.Total > 0
    ? ((totalNg / record.Total) * 100).toFixed(1)
    : "0.0";

  const handleViewInFactory = () => {
    const params = new URLSearchParams();
    params.set("dateFrom", record.Date);
    params.set("dateTo", record.Date);
    if (record["背番号"]) {
      params.set("sebanggo", record["背番号"]);
    }
    params.set("autoOpen", "true");
    const url = `${import.meta.env.BASE_URL}factory/overview?${params.toString()}`;
    window.open(url, "_blank");
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t("stopCallDetails")}
      subtitle={`${record["設備"]} · ${record.Date}`}
      eyebrow={record["工場"]}
      maxWidth="max-w-2xl"
      align="start"
    >
      <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
        {/* Selected Stop Call */}
        {stopCallEntry && (
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 18 }}>phone_missed</span>
              <h4 className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("stopCallDetails")}</h4>
            </div>
            <div>
              <InfoRow label={t("leaderName")} value={stopCallEntry.leaderName} />
              <InfoRow
                label={t("role")}
                value={<RoleBadge role={stopCallEntry.leaderRole} />}
              />
              <InfoRow label={t("calledAt")} value={stopCallEntry.calledAt} />
              <InfoRow label={t("arrivedAt")} value={stopCallEntry.arrivedAt} />
              <InfoRow
                label={t("waitTime")}
                value={fmtWait(stopCallEntry.waitSeconds)}
                accent={stopCallEntry.waitSeconds > 300 ? "text-[var(--status-danger)]" : stopCallEntry.waitSeconds > 120 ? "text-amber-500" : "text-emerald-500"}
              />
            </div>
          </div>
        )}

        {/* Equipment & Product Info */}
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 18 }}>precision_manufacturing</span>
            <h4 className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">設備情報</h4>
          </div>
          <div>
            <InfoRow label="設備" value={record["設備"]} />
            <InfoRow label="背番号" value={record["背番号"]} />
            <InfoRow label="品番" value={record["品番"]} />
            <InfoRow label={t("worker")} value={record.Worker_Name} />
            <InfoRow label="工場" value={record["工場"]} />
          </div>
        </div>

        {/* Production Context */}
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 18 }}>analytics</span>
            <h4 className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("productionContext")}</h4>
          </div>
          <div>
            <InfoRow label={t("date")} value={record.Date} />
            <InfoRow label={t("timeStart")} value={record.Time_start} />
            <InfoRow label={t("timeEnd")} value={record.Time_end} />
            <InfoRow label={t("completedQty")} value={record.Process_Quantity} />
            <InfoRow label={t("total")} value={record.Total} />
            <InfoRow label="Total NG" value={totalNg} />
            <InfoRow
              label={t("defectRate")}
              value={`${defectRate}%`}
              accent={parseFloat(defectRate) > 2 ? "text-[var(--status-danger)]" : parseFloat(defectRate) > 1 ? "text-amber-500" : "text-emerald-500"}
            />
            <InfoRow label={t("cycleTime")} value={record.Cycle_Time ? `${record.Cycle_Time}s` : "—"} />
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={handleViewInFactory}
              className="w-full py-2 rounded-[6px] bg-[var(--freya-blue)] text-white text-xs font-semibold hover:bg-[var(--freya-blue-hover)] shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
              View in Factory Overview
            </button>
          </div>
        </div>

        {/* Other Stop Calls in same session */}
        {allStopCalls && allStopCalls.length > 1 && (
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 18 }}>list</span>
              <h4 className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("otherStopCalls")}</h4>
            </div>
            <div className="space-y-2">
              {allStopCalls.map((sc, idx) => {
                const isSelected = stopCallEntry && sc.calledAt === stopCallEntry.calledAt && sc.leaderUsername === stopCallEntry.leaderUsername;
                return (
                  <div
                    key={idx}
                    className={`rounded-[6px] p-2.5 text-xs transition-all border ${
                      isSelected
                        ? "bg-[var(--surface-subtle)] border-[var(--freya-blue)] ring-1 ring-[var(--freya-blue)]/30"
                        : "bg-[var(--surface)] border-[var(--border)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--text-primary)]">{sc.leaderName}</span>
                      <RoleBadge role={sc.leaderRole} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-4 text-[var(--text-secondary)] font-mono">
                      <span>{sc.calledAt} → {sc.arrivedAt}</span>
                      <span className={`font-bold ${sc.waitSeconds > 300 ? "text-[var(--status-danger)]" : sc.waitSeconds > 120 ? "text-amber-500" : "text-emerald-500"}`}>
                        {fmtWait(sc.waitSeconds)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
