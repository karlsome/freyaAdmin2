import { STATUS_THEME, formatNumber, statusLabel } from "./twinTheme";
import { KENSA_KIND_LABEL, kensaNgBreakdown, kensaStatus } from "./kensaLive";

function hm(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Stat({ label, value, tone }) {
  return (
    <div className="twin-kensa__stat" style={tone ? { "--tone": tone } : undefined}>
      <div className="twin-kensa__stat-value">{value}</div>
      <div className="twin-kensa__stat-label">{label}</div>
    </div>
  );
}

/**
 * Detail drawer for an inspection table: the live Kensa interactive session (scanned boxes, NG counters,
 * labels printed, quantities) plus what was already submitted today.
 */
export default function KensaDrawer({ machineId, title, live, call, today, isJa, onClose }) {
  const status = kensaStatus(live, call);
  const theme = STATUS_THEME[status] || STATUS_THEME.off;
  const k = live?.kensa || null;
  const ngRows = kensaNgBreakdown(k, isJa);
  const labels = (k?.labels || []).filter((l) => !l.voided);
  const t = (ja, en) => (isJa ? ja : en);

  return (
    <aside className="twin-drawer" style={{ "--status": theme.color }} aria-label={title}>
      <div className="twin-drawer__header">
        <div className="min-w-0">
          <h2 className="twin-drawer__title">{title}</h2>
          <div className="twin-drawer__pair twin-drawer__pair--solo">
            <span className="material-symbols-outlined">fact_check</span>
            {machineId} · {t("検査テーブル", "Inspection table")}
          </div>
        </div>
        <button type="button" className="twin-icon-btn" onClick={onClose} aria-label={t("閉じる", "Close")}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className={`twin-drawer__status ${theme.pulse ? "twin-drawer__status--alert" : ""}`}>
        <span className="material-symbols-outlined">{theme.icon}</span>
        <span>{k || status !== "off" ? statusLabel(status, isJa) : t("未使用", "Not in use")}</span>
      </div>

      {k ? (
        <>
          <div className="twin-drawer__section">
            <div className="twin-drawer__section-header">
              <div className="twin-drawer__section-title">
                <span className="material-symbols-outlined">inventory_2</span>
                {t("現在の検査", "Current inspection")}
              </div>
            </div>
            <div className="twin-kensa__product">
              <b>{k.hinban}</b>
              {k.sebango && <span> · {k.sebango}</span>}
              {k.hinmei && <div className="twin-kensa__muted">{k.hinmei}</div>}
              {live?.worker && <div className="twin-kensa__muted">👷 {live.worker}{k.start ? ` · ${t("開始", "Start")} ${k.start}` : ""}</div>}
            </div>
            <div className="twin-kensa__stats">
              <Stat label={t("処理数", "Processed")} value={formatNumber(k.processQty)} />
              <Stat label={t("良品", "Good")} value={formatNumber(k.good)} tone="#22c55e" />
              <Stat label="NG" value={formatNumber(k.ngTotal)} tone={k.ngTotal > 0 ? "#ef4444" : undefined} />
            </div>
            {k.cap > 0 && <div className="twin-kensa__muted">{t("収容数", "Box capacity")}: {k.cap}</div>}
          </div>

          <div className="twin-drawer__section">
            <div className="twin-drawer__section-header">
              <div className="twin-drawer__section-title">
                <span className="material-symbols-outlined">qr_code_scanner</span>
                {t("スキャン済み", "Scanned")} ({k.inputs.length})
              </div>
            </div>
            <div className="twin-kensa__list">
              {k.inputs.map((x, i) => (
                <div key={`${x.id}-${i}`} className={`twin-kensa__row ${x.current ? "twin-kensa__row--cur" : ""}`}>
                  <div className="twin-kensa__row-main">
                    <span className="twin-kensa__id">{x.id || (KENSA_KIND_LABEL.legacy[isJa ? "ja" : "en"] + (x.lots[0] ? ` ${x.lots[0]}` : ""))}</span>
                    <span className="twin-kensa__tag">{(KENSA_KIND_LABEL[x.kind] || KENSA_KIND_LABEL.legacy)[isJa ? "ja" : "en"]}</span>
                    {x.current && <span className="twin-kensa__tag twin-kensa__tag--cur">{t("検査中", "Active")}</span>}
                  </div>
                  <div className="twin-kensa__row-sub">
                    {t("数量", "Qty")} {x.qty}
                    {x.ngTotal > 0 && <span className="twin-kensa__ng"> · NG {x.ngTotal}</span>}
                    {x.lots.length > 0 && <span> · {x.lots.join(", ")}</span>}
                    {x.scannedAt > 0 && <span> · {hm(x.scannedAt)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="twin-drawer__section">
            <div className="twin-drawer__section-header">
              <div className="twin-drawer__section-title">
                <span className="material-symbols-outlined">bug_report</span>
                {t("NG内訳", "NG breakdown")}
              </div>
            </div>
            {ngRows.length === 0 ? (
              <div className="twin-kensa__muted">{t("NGなし", "No NG yet")}</div>
            ) : (
              <div className="twin-kensa__chips">
                {ngRows.map((r) => (
                  <span key={r.n} className="twin-kensa__chip">{r.label}: <b>{r.count}</b></span>
                ))}
              </div>
            )}
          </div>

          <div className="twin-drawer__section">
            <div className="twin-drawer__section-header">
              <div className="twin-drawer__section-title">
                <span className="material-symbols-outlined">label</span>
                {t("発行ラベル", "Labels printed")} ({labels.length})
              </div>
            </div>
            {labels.length === 0 ? (
              <div className="twin-kensa__muted">{t("まだ発行なし", "None yet")}</div>
            ) : (
              <div className="twin-kensa__list">
                {labels.map((l) => (
                  <div key={l.kensaId} className="twin-kensa__row">
                    <div className="twin-kensa__row-main">
                      <span className="twin-kensa__id">{l.kensaId}</span>
                      <span className="twin-kensa__tag">{l.status === "draft" ? t("仮", "Draft") : t("完了", "Complete")}</span>
                    </div>
                    <div className="twin-kensa__row-sub">{t("数量", "Qty")} {l.qty}{l.at ? ` · ${hm(l.at)}` : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="twin-drawer__section">
          <div className="twin-kensa__muted">
            {t("現在このテーブルでの検査はありません。", "Nobody is inspecting at this table right now.")}
          </div>
        </div>
      )}

      <div className="twin-drawer__section">
        <div className="twin-drawer__section-header">
          <div className="twin-drawer__section-title">
            <span className="material-symbols-outlined">task_alt</span>
            {t("本日の提出", "Submitted today")}{today?.date ? ` (${today.date})` : ""}
          </div>
        </div>
        {!today || today.records.length === 0 ? (
          <div className="twin-kensa__muted">{t("提出済みの記録なし", "No submitted records yet")}</div>
        ) : (
          <>
            <div className="twin-kensa__stats">
              <Stat label={t("処理数", "Processed")} value={formatNumber(today.processed)} />
              <Stat label={t("良品", "Good")} value={formatNumber(today.good)} tone="#22c55e" />
              <Stat label="NG" value={formatNumber(today.ng)} tone={today.ng > 0 ? "#ef4444" : undefined} />
            </div>
            <div className="twin-kensa__list">
              {today.records.slice().reverse().map((r, i) => (
                <div key={`${r.submittedAt}-${i}`} className="twin-kensa__row">
                  <div className="twin-kensa__row-main">
                    <span className="twin-kensa__id">{r.hinban}</span>
                    <span className="twin-kensa__tag">{r.start}–{r.end}</span>
                  </div>
                  <div className="twin-kensa__row-sub">
                    {t("良品", "Good")} {r.good} · NG {r.ng} · {t("処理", "Proc")} {r.processed} · 🏷{r.labels}
                    {r.worker ? ` · ${r.worker}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
