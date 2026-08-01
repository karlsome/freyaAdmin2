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
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs text-on-surface-variant flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${accent || "text-on-surface"}`}>{value ?? "—"}</span>
    </div>
  );
}

function RoleBadge({ role }) {
  const color = role === "admin"
    ? "bg-primary/15 text-primary"
    : role === "班長"
      ? "bg-amber-400/15 text-amber-500"
      : "bg-emerald-400/15 text-emerald-400";

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {role}
    </span>
  );
}

export default function StopCallDetailModal({ open, onClose, record, stopCallEntry, allStopCalls }) {
  const { t } = useLanguage();

  if (!open || !record) return null;

  const defectRate = record.Total > 0
    ? ((record.Total_NG / record.Total) * 100).toFixed(1)
    : "0.0";

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
      <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-6">
        {/* Selected Stop Call */}
        {stopCallEntry && (
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>phone_missed</span>
              <h4 className="text-sm font-semibold text-on-surface">{t("stopCallDetails")}</h4>
            </div>
            <div className="divide-y divide-separator/20">
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
                accent={stopCallEntry.waitSeconds > 300 ? "text-error" : stopCallEntry.waitSeconds > 120 ? "text-amber-400" : "text-emerald-400"}
              />
            </div>
          </div>
        )}

        {/* Equipment & Product Info */}
        <div className="glass-card rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>precision_manufacturing</span>
            <h4 className="text-sm font-semibold text-on-surface">設備情報</h4>
          </div>
          <div className="divide-y divide-separator/20">
            <InfoRow label="設備" value={record["設備"]} />
            <InfoRow label="背番号" value={record["背番号"]} />
            <InfoRow label="品番" value={record["品番"]} />
            <InfoRow label={t("worker")} value={record.Worker_Name} />
            <InfoRow label="工場" value={record["工場"]} />
          </div>
        </div>

        {/* Production Context */}
        <div className="glass-card rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>analytics</span>
            <h4 className="text-sm font-semibold text-on-surface">{t("productionContext")}</h4>
          </div>
          <div className="divide-y divide-separator/20">
            <InfoRow label={t("date")} value={record.Date} />
            <InfoRow label={t("timeStart")} value={record.Time_start} />
            <InfoRow label={t("timeEnd")} value={record.Time_end} />
            <InfoRow label={t("completedQty")} value={record.Process_Quantity} />
            <InfoRow label={t("total")} value={record.Total} />
            <InfoRow label="Total NG" value={record.Total_NG} />
            <InfoRow
              label={t("defectRate")}
              value={`${defectRate}%`}
              accent={parseFloat(defectRate) > 2 ? "text-error" : parseFloat(defectRate) > 1 ? "text-amber-400" : "text-emerald-400"}
            />
            <InfoRow label={t("cycleTime")} value={record.Cycle_Time ? `${record.Cycle_Time}s` : "—"} />
          </div>
        </div>

        {/* Other Stop Calls in same session */}
        {allStopCalls && allStopCalls.length > 1 && (
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>list</span>
              <h4 className="text-sm font-semibold text-on-surface">{t("otherStopCalls")}</h4>
            </div>
            <div className="space-y-2">
              {allStopCalls.map((sc, idx) => {
                const isSelected = stopCallEntry && sc.calledAt === stopCallEntry.calledAt && sc.leaderUsername === stopCallEntry.leaderUsername;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl p-3 text-xs transition-all ${
                      isSelected
                        ? "bg-primary/10 border border-primary/20"
                        : "bg-surface-container-low/40 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-on-surface">{sc.leaderName}</span>
                      <RoleBadge role={sc.leaderRole} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-4 text-on-surface-variant">
                      <span>{sc.calledAt} → {sc.arrivedAt}</span>
                      <span className={`font-semibold ${sc.waitSeconds > 300 ? "text-error" : sc.waitSeconds > 120 ? "text-amber-400" : "text-emerald-400"}`}>
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
