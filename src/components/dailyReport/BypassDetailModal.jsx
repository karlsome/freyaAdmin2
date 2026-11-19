import ModalShell from "../ModalShell";

function fmtDateTime(iso, isJa) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(isJa ? "ja-JP" : "en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TIMING = {
  pre: ["Before work (start-of-job check)", "作業前（始業点検）"],
  post: ["After work (end-of-job check)", "作業後（終業点検）"],
};

/** One checklist bypass: who skipped which checklist, on which machine, when and why. */
export default function BypassDetailModal({ bypass, isJa, onClose, onOpenLeader }) {
  const L = (en, ja) => (isJa ? ja : en);
  const timing = TIMING[bypass.timing];
  const templates = Array.isArray(bypass.templates) ? bypass.templates : [];

  const sections = [
    {
      icon: "precision_manufacturing",
      title: L("Where", "どこで"),
      rows: [
        [L("Factory", "工場"), bypass.factory || "—"],
        [L("Machine", "設備"), bypass.machine || "—"],
        [L("Worker", "作業者"), bypass.workerName || "—"],
      ],
    },
    {
      icon: "verified_user",
      title: L("Who approved the bypass", "スキップを許可した人"),
      rows: [
        [
          L("Leader", "リーダー"),
          bypass.leaderName ? (
            onOpenLeader ? (
              <button
                type="button"
                onClick={() => onOpenLeader(bypass.leaderName, bypass.factory)}
                className="inline-flex items-center gap-1 font-semibold text-[var(--freya-blue)] hover:underline"
              >
                {bypass.leaderName}
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>chevron_right</span>
              </button>
            ) : (
              bypass.leaderName
            )
          ) : (
            "—"
          ),
        ],
        [L("Role", "役職"), bypass.leaderRole ? <span className="freya-badge freya-badge-warning">{bypass.leaderRole}</span> : "—"],
        [L("Username", "ユーザー名"), bypass.leaderUsername || "—"],
      ],
    },
    {
      icon: "schedule",
      title: L("When and why", "いつ・なぜ"),
      rows: [
        [L("Time", "日時"), fmtDateTime(bypass.bypassedAt || bypass.createdAt, isJa)],
        [L("Check skipped", "スキップした点検"), timing ? L(timing[0], timing[1]) : bypass.timing || "—"],
        [L("Reason", "理由"), <span className="font-semibold">{bypass.reason || "—"}</span>],
      ],
    },
  ];

  return (
    <ModalShell
      open
      onClose={onClose}
      eyebrow={bypass.factory}
      title={L("Checklist bypass", "チェックリストのスキップ")}
      subtitle={`${bypass.machine || ""} · ${fmtDateTime(bypass.bypassedAt || bypass.createdAt, isJa)}`}
      maxWidth="max-w-xl"
      zIndex="z-[70]"
    >
      <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4">
        {sections.map((s) => (
          <section key={s.title} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>{s.icon}</span>
              {s.title}
            </h4>
            <dl>
              {s.rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-2 last:border-b-0">
                  <dt className="text-[13px] text-[var(--text-secondary)]">{k}</dt>
                  <dd className="text-right text-[13px] text-[var(--text-primary)]">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>checklist</span>
            {L("Checklists not done", "実施されなかったチェックリスト")}
          </h4>
          {templates.length ? (
            <ul className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <li key={t} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)]">
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[var(--text-muted)]">—</p>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
