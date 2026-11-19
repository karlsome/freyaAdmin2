/**
 * Words for the Daily Report page. The server (/api/reports/daily) sends only
 * numbers and names; this file turns each finding into a title, a sentence,
 * a "what to check" hint and labels, in English or Japanese.
 */

export const CATEGORY_META = {
  quality: { en: "Quality", ja: "品質", color: "#DC2626", icon: "verified" },
  speed: { en: "Speed", ja: "速度", color: "#D97706", icon: "speed" },
  people: { en: "People", ja: "人員", color: "#2563EB", icon: "group" },
  leaders: { en: "Leaders", ja: "リーダー", color: "#7C3AED", icon: "support_agent" },
  data: { en: "Data", ja: "データ", color: "#64748B", icon: "fact_check" },
  flow: { en: "Flow", ja: "生産量", color: "#0D9488", icon: "conveyor_belt" },
};

export const SEVERITY_META = {
  high: { en: "High", ja: "要対応", className: "freya-badge freya-badge-defect", color: "var(--status-defect)", group: "attention" },
  medium: { en: "Watch", ja: "注意", className: "freya-badge freya-badge-warning", color: "var(--status-warning)", group: "attention" },
  info: { en: "FYI", ja: "参考", className: "freya-badge dr-badge-info", color: "var(--text-secondary)", group: "info" },
  ongoing: { en: "Ongoing", ja: "継続", className: "freya-badge dr-badge-ongoing", color: "#7C3AED", group: "other" },
  good: { en: "Better", ja: "良好", className: "freya-badge freya-badge-normal", color: "var(--status-complete)", group: "other" },
};

export const GROUPS = [
  { key: "attention", en: "Needs attention", ja: "要対応" },
  { key: "info", en: "For your information", ja: "参考情報" },
  { key: "other", en: "Ongoing and good news", ja: "継続中・良いニュース" },
];

const PROCESS = {
  press: { en: "press", ja: "プレス" },
  kensa: { en: "inspection", ja: "検査" },
  slit: { en: "slit", ja: "スリット" },
  srs: { en: "SRS", ja: "SRS" },
};

const COLUMNS = {
  factory: ["Factory", "工場"],
  machine: ["Machine", "設備"],
  worker: ["Worker", "作業者"],
  ngQty: ["NG / Qty", "不良 / 数量"],
  ngRate: ["NG %", "不良率"],
  seban: ["背番号", "背番号"],
  hinban: ["品番", "品番"],
  comment: ["Comment", "コメント"],
  qty: ["Qty", "数量"],
  ng: ["NG", "不良"],
  total: ["Total", "Total"],
  expected: ["Expected", "本来の値"],
  cycleToday: ["Cycle today", "本日サイクル"],
  cycleNormal: ["Normal", "通常"],
  change: ["Change", "変化"],
  leader: ["Leader", "リーダー"],
  callsToday: ["Calls today", "本日件数"],
  callsNormal: ["Normal / day", "通常 / 日"],
  avgWait: ["Avg wait", "平均待ち"],
  maxWait: ["Longest wait", "最長待ち"],
  calledAt: ["Called", "呼出"],
  arrivedAt: ["Arrived", "到着"],
  waitSec: ["Wait", "待ち時間"],
  reason: ["Reason", "理由"],
  process: ["Process", "工程"],
  lastSeen: ["Last seen", "最終提出"],
  daysIn30: ["Days in last 30", "直近30日の出勤"],
  recordsToday: ["Records today", "本日件数"],
  start: ["Start", "開始"],
  end: ["End", "終了"],
  minutes: ["Minutes", "分"],
  approved: ["Approved", "承認済"],
  waiting: ["Waiting", "未承認"],
  pressed: ["Pressed", "プレス数"],
  inspected: ["Inspected", "検査数"],
};

const WEEKDAYS = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  ja: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"],
};

// ─── formatting ──────────────────────────────────────────────────────────────
export function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v < 1 && v > 0 ? v.toFixed(2) : v.toFixed(1)}%`;
}
export function fmtNum(v, dp = 1) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString("en-US");
  const f = 10 ** dp;
  return String(Math.round(n * f) / f);
}
export function fmtWait(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function fmtUnit(v, unit) {
  if (v == null) return "—";
  if (unit === "%") return fmtPct(v);
  if (unit === "s") return `${fmtNum(v)} s`;
  if (unit === "d") return `${fmtNum(v, 0)} d`;
  return fmtNum(v);
}
export function md(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}
export function columnLabel(key, isJa) {
  const c = COLUMNS[key];
  return c ? c[isJa ? 1 : 0] : key;
}

/** Formats a raw table cell for its column. */
export function formatCell(column, value) {
  if (value == null || value === "") return "—";
  if (column === "avgWait" || column === "maxWait" || column === "waitSec") return fmtWait(Number(value));
  if (typeof value === "number") return fmtNum(value);
  return String(value);
}

function list(items, isJa) {
  return items.join(isJa ? "、" : ", ");
}

// ─── per-finding text ────────────────────────────────────────────────────────
/**
 * Returns { title, text, check, big, normal, trendLabel, compareTitle } for a finding.
 */
export function describeFinding(f, isJa) {
  const p = f.params || {};
  const L = (en, ja) => (isJa ? ja : en);
  const proc = (key) => PROCESS[key]?.[isJa ? "ja" : "en"] || key;
  const normally = (v) => L(`normally ${v}`, `通常 ${v}`);
  const sameCompare = L("Today vs this part's normal NG %", "本日 vs この品番の通常不良率");

  switch (f.type) {
    case "qualityMultiPlace": {
      const places = (p.places || []).map((x) => `${x.factory} ${x.machine}（${x.worker}）${fmtPct(x.rate)}`);
      return {
        title: L(`${p.seban} NG is high in ${p.places.length} places at once`, `${p.seban}の不良率が${p.places.length}か所で同時に高い`),
        big: fmtPct(p.rate),
        normal: normally(fmtPct(p.base)),
        text: L(
          `${list(places)}. When the same part is bad in different places, the cause is usually upstream: the press run or the material lot.`,
          `${list(places, true)}。同じ部品が別々の場所で悪い場合、原因は前工程（プレス・材料ロット）にあることが多いです。`
        ),
        check: L(
          `Find which press run and material lot these ${p.seban} pieces came from.${p.prevHigh ? ` It was last this high on ${md(p.prevHigh.date)} (${fmtPct(p.prevHigh.rate)}).` : ""}`,
          `この${p.seban}がどのプレス作業・材料ロットから来たか確認してください。${p.prevHigh ? `前回この水準だったのは${md(p.prevHigh.date)}（${fmtPct(p.prevHigh.rate)}）です。` : ""}`
        ),
        trendLabel: L(`${p.seban} ${proc(p.process)} NG % per day (everyone)`, `${p.seban} ${proc(p.process)}不良率（日別・全員）`),
        compareTitle: sameCompare,
      };
    }

    case "qualitySpike": {
      const parts = p.parts || [];
      const comment = parts.find((x) => x.comment)?.comment;
      const partsText = parts.map((x) => `${x.seban} ${x.ng}/${fmtNum(x.qty)}`);
      return {
        title:
          parts.length > 1
            ? L(`${p.worker}: very high NG on ${parts.length} parts`, `${p.worker}：${parts.length}品番で不良率が非常に高い`)
            : L(`${p.worker}: very high NG on ${p.topPart}`, `${p.worker}：${p.topPart}の不良率が非常に高い`),
        big: fmtPct(p.rate),
        normal: L(`normally ${fmtPct(p.base)} on ${p.topPart}`, `${p.topPart}の通常 ${fmtPct(p.base)}`),
        text:
          L(`${list(partsText)} at ${p.machine}.`, `${p.machine}で ${list(partsText, true)}。`) +
          (p.topPartOthers ? L(` Across all ${p.topPart} work today the rate was ${fmtPct(p.topPartAllRate)}.`, `本日の${p.topPart}全体では${fmtPct(p.topPartAllRate)}でした。`) : "") +
          (comment ? L(` Comment: "${comment}".`, `コメント：「${comment}」`) : ""),
        check: p.prevSpike
          ? L(
              `${p.topPart} also jumped to ${fmtPct(p.prevSpike.rate)} on ${md(p.prevSpike.date)}. Check whether it came from the same lot.`,
              `${p.topPart}は${md(p.prevSpike.date)}にも${fmtPct(p.prevSpike.rate)}まで上がっています。同じロットか確認してください。`
            )
          : p.process === "kensa"
            ? L(
                `Was this one bad box, or is ${p.worker} judging more strictly than others? Check the material lot too.`,
                `1箱だけの問題か、${p.worker}さんの判定が他より厳しいのか確認してください。材料ロットも確認を。`
              )
            : L("Check the machine setup and the material lot for this run.", "この作業の設備セットアップと材料ロットを確認してください。"),
        trendLabel: L(`${p.topPart} NG % per day (all workers)`, `${p.topPart}の不良率（日別・全作業者）`),
        compareTitle: sameCompare,
      };
    }

    case "qualityOngoing": {
      const names = [...new Set((p.parts || []).map((x) => x.seban))];
      return {
        title: L(`${names.join(" / ")} NG stays high`, `${names.join(" / ")}の不良率は常に高い`),
        big: fmtPct(p.rate),
        normal: normally(fmtPct(p.base)),
        text: L(
          "High, but not new: these parts run at this NG level most days. They are shown here so they don't push new problems off the top of the page.",
          "高いですが新しい問題ではありません。これらの品番は普段からこの不良率です。新しい問題が埋もれないよう、ここにまとめています。"
        ),
        check: L("A known issue. If it should be fixed, give it an owner and a target.", "既知の問題です。改善する場合は担当者と目標を決めてください。"),
        trendLabel: L("NG % per day for these parts", "これらの品番の不良率（日別）"),
        compareTitle: sameCompare,
      };
    }

    case "qualityFactoryRate": {
      const wp = p.weekdayPattern;
      const wd = wp ? WEEKDAYS[isJa ? "ja" : "en"][wp.weekday] : "";
      const otherSpikes = wp ? wp.dates.filter((d) => d !== f._date) : [];
      return {
        title: p.topDefect
          ? L(`${p.factory} ${proc(p.process)} NG is up, mostly ${p.topDefect.name}`, `${p.factory}の${proc(p.process)}不良率が上昇（主に${p.topDefect.name}）`)
          : L(`${p.factory} ${proc(p.process)} NG is up`, `${p.factory}の${proc(p.process)}不良率が上昇`),
        big: fmtPct(p.rate),
        normal: normally(fmtPct(p.base)),
        text:
          (p.topRecord ? L(`${p.topRecord.seban}: ${fmtNum(p.topRecord.ng)} NG of ${fmtNum(p.topRecord.qty)}. `, `${p.topRecord.seban}：${fmtNum(p.topRecord.qty)}個中${fmtNum(p.topRecord.ng)}個が不良。`) : "") +
          (p.topDefect ? L(`${p.topDefect.name} is ${p.topDefect.share}% of defects today (normally ${p.topDefect.baseShare}%). `, `本日の不良の${p.topDefect.share}%が${p.topDefect.name}（通常${p.topDefect.baseShare}%）。`) : "") +
          (wp
            ? L(`It also spiked on ${otherSpikes.map(md).join(", ")}, all ${wd}s.`, `${otherSpikes.map(md).join("、")}にも上昇しており、すべて${wd}です。`)
            : p.spikeDays?.length
              ? L(`It spiked ${p.spikeDays.length} other times in the last 30 days.`, `直近30日で他に${p.spikeDays.length}回上昇しています。`)
              : L("First spike in 30 days.", "直近30日で初めての上昇です。")),
        check: wp
          ? L(`What runs on ${wd}s at ${p.factory}? A weekly pattern points to one product, material or shift.`, `${p.factory}で${wd}に何を生産していますか？週ごとのパターンは特定の製品・材料・シフトが原因の可能性があります。`)
          : L("Look at the top records below and the material lots used today.", "下の上位レコードと本日使用した材料ロットを確認してください。"),
        trendLabel: L(`${p.factory} ${proc(p.process)} NG % per day`, `${p.factory} ${proc(p.process)}不良率（日別）`),
        compareTitle: L("NG %, today vs normal", "不良率 本日 vs 通常"),
      };
    }

    case "qualityGood":
      return {
        title: L(`${p.factory} ${proc(p.process)} NG was very low`, `${p.factory}の${proc(p.process)}不良率がとても低い`),
        big: fmtPct(p.rate),
        normal: normally(fmtPct(p.base)),
        text: L(
          `${fmtNum(p.ng)} NG out of ${fmtNum(p.qty)} (normal output ${fmtNum(p.baseQty)} a day).`,
          `${fmtNum(p.qty)}個中 不良${fmtNum(p.ng)}個（通常の生産数 ${fmtNum(p.baseQty)}個/日）。`
        ),
        check: L("Nothing to fix. Worth asking what went right today.", "対応不要です。今日うまくいった理由を聞いてみる価値があります。"),
        trendLabel: L(`${p.factory} ${proc(p.process)} NG % per day`, `${p.factory} ${proc(p.process)}不良率（日別）`),
        compareTitle: L("NG %, today vs normal", "不良率 本日 vs 通常"),
      };

    case "speedSlow": {
      const w = p.worst || {};
      return {
        title:
          p.count === 1
            ? L(`${w.machine} ran ${fmtNum(w.ratio)}× slower than usual`, `${w.machine}が通常の${fmtNum(w.ratio)}倍遅い`)
            : L(`${p.count} jobs ran much slower than usual`, `${p.count}件の作業が通常より大幅に遅い`),
        big: `${fmtNum(w.ratio)}×`,
        normal: `${w.hinban}: ${fmtNum(w.base)} s → ${fmtNum(w.today)} s`,
        text:
          L(
            `Compared with the same machine and part at a similar run size. Slowest: ${w.hinban} on ${w.machine}, ${fmtNum(w.today)} s per cycle (normally ${fmtNum(w.base)} s).`,
            `同じ設備・同じ品番・同程度の数量と比較。最も遅いのは${w.machine}の${w.hinban}で、1サイクル${fmtNum(w.today)}秒（通常${fmtNum(w.base)}秒）。`
          ) +
          (w.slowPrev ? L(` It was already slow on the previous working day (${fmtNum(w.prevCt)} s).`, `前営業日もすでに遅くなっていました（${fmtNum(w.prevCt)}秒）。`) : "") +
          (p.machineNgRate >= 3 ? L(` NG on ${w.machine} today: ${fmtPct(p.machineNgRate)}.`, `本日の${w.machine}の不良率：${fmtPct(p.machineNgRate)}。`) : ""),
        check: w.slowPrev
          ? L("Two slow days in a row on the same machine. Check it (blade, vacuum, program speed) before it gets worse.", "同じ設備で2日続けて遅くなっています。悪化する前に設備（刃・吸着・プログラム速度）を点検してください。")
          : L("Ask the operator what slowed the run: setup, material, or stops.", "作業者に遅くなった理由（段取り・材料・停止）を確認してください。"),
        trendLabel: L(`${w.hinban} on ${w.machine}: cycle time (s) per day`, `${w.machine} ${w.hinban}：サイクルタイム（秒・日別）`),
        compareTitle: L("Cycle time (s), today vs normal", "サイクルタイム（秒） 本日 vs 通常"),
      };
    }

    case "leaderLoad": {
      const absent = p.absent || [];
      const over = p.over || [];
      const overText = over.map((o) => L(`${o.name} took ${o.today} (normally ${fmtNum(o.base)})`, `${o.name}が${o.today}件（通常${fmtNum(o.base)}件）`));
      return {
        title: absent.length
          ? L(`${absent[0].name} answered no stop calls${over.length ? "; others covered" : ""}`, `${absent[0].name}のストップコール対応が0件${over.length ? "（他のリーダーがカバー）" : ""}`)
          : L(`${over[0].name} took ${over[0].today} stop calls`, `${over[0].name}が${over[0].today}件のストップコールに対応`),
        big: absent.length ? "0" : String(over[0].today),
        normal: normally(L(`${fmtNum(absent.length ? absent[0].base : over[0].base)} a day`, `${fmtNum(absent.length ? absent[0].base : over[0].base)}件/日`)),
        text:
          (overText.length ? L(`${overText.join(" and ")}. `, `${overText.join("、")}。`) : "") +
          L(`${p.total} calls in total. Console / script unlocks are not counted.`, `合計${p.total}件。コンソール/スクリプト解除は含みません。`),
        check: absent.length
          ? L(
              `Was ${absent[0].name} off today or busy elsewhere?${over.length ? ` ${over[0].name} carried a much bigger load than usual.` : ""}`,
              `${absent[0].name}さんは休みでしたか、それとも別の作業でしたか？${over.length ? `${over[0].name}さんの負担が通常より大幅に増えています。` : ""}`
            )
          : L(`${over[0].name} handled far more calls than usual. Check whether the load should be shared.`, `${over[0].name}さんの対応件数が通常より大幅に多いです。負担を分担すべきか確認してください。`),
        trendLabel: L(`Stop calls answered by ${p.focus} per day`, `${p.focus}のストップコール対応数（日別）`),
        compareTitle: L("Stop calls per leader, today vs daily normal", "リーダー別ストップコール 本日 vs 通常/日"),
      };
    }

    case "machineCalls":
      return {
        title: L(`${p.machine} called a leader ${p.today} times`, `${p.machine}がリーダーを${p.today}回呼び出し`),
        big: String(p.today),
        normal: normally(L(`${fmtNum(p.base)} a day`, `${fmtNum(p.base)}件/日`)),
        text:
          (p.next ? L(`The next highest machine was ${p.next.machine} with ${p.next.today}. `, `次に多いのは${p.next.machine}の${p.next.today}件。`) : "") +
          L("Console / script unlocks are not counted.", "コンソール/スクリプト解除は含みません。"),
        check: L(`Ask the operator what kept stopping ${p.machine}. Look for a pattern in the call times below.`, `${p.machine}が何度も止まった理由を作業者に確認してください。下の呼出時刻にパターンがないか見てください。`),
        trendLabel: L(`${p.machine} stop calls per day`, `${p.machine}のストップコール数（日別）`),
        compareTitle: L("Stop calls per machine, today vs normal", "設備別ストップコール 本日 vs 通常"),
      };

    case "checklistBypass":
      return {
        title: L(`Startup checklist skipped ${p.count}×`, `始業点検のスキップ ${p.count}件`),
        big: String(p.count),
        normal: L(`${p.count30} in the last 30 days`, `直近30日で${p.count30}件`),
        text:
          L(`${p.first?.leader} skipped the checklist on ${p.first?.machine} (reason: "${p.first?.reason}").`, `${p.first?.leader}が${p.first?.machine}の点検をスキップ（理由：「${p.first?.reason}」）。`) +
          (p.openTickets ? L(` ${p.openTickets} NG tickets are still open at ${p.factory}.`, `${p.factory}には未解決のNGチケットが${p.openTickets}件あります。`) : ""),
        check: L("A skip for a trial run is usually fine. Make sure a full check happens before real production.", "トライでのスキップは通常問題ありません。本生産の前に必ず点検を行ってください。"),
        trendLabel: "",
        compareTitle: L("Skips today vs daily average", "スキップ 本日 vs 1日平均"),
      };

    case "peopleAbsent":
    case "peopleMissingToday":
    case "peopleNew": {
      const ws = p.workers || [];
      const shown = ws.slice(0, 5);
      const more = p.count - shown.length;
      const names =
        f.type === "peopleNew"
          ? shown.map((w) => `${w.name}（${w.factory} ${proc(w.process)}）`)
          : shown.map((w) => `${w.name}（${w.factory}, ${L("last", "最終")} ${md(w.lastSeen)}）`);
      const moreText = more > 0 ? L(` and ${more} more`, ` ほか${more}名`) : "";
      if (f.type === "peopleAbsent") {
        return {
          title: L(`${p.count} regular workers missing for 5+ working days`, `常勤者${p.count}名が5営業日以上不在`),
          big: String(p.count),
          normal: L("each usually works most days", "普段はほぼ毎日出勤"),
          text: L(`${list(names)}${moreText}.`, `${list(names, true)}${moreText}。`),
          check: L("Confirm these are planned absences (leave, transfer).", "予定された休み（休暇・異動）か確認してください。"),
          trendLabel: "",
          compareTitle: L("Days worked in the last 30", "直近30日の出勤日数"),
        };
      }
      if (f.type === "peopleMissingToday") {
        return {
          title: L(`${p.count} regulars missing today`, `本日不在の常勤者 ${p.count}名`),
          big: String(p.count),
          normal: L("all worked in the last 5 days", "全員直近5日以内に出勤"),
          text: L(`${list(names)}${moreText}.`, `${list(names, true)}${moreText}。`),
          check: L("Normal for one day. Worth a look if the same names show up again tomorrow.", "1日だけなら通常です。明日も同じ名前が出たら確認してください。"),
          trendLabel: "",
          compareTitle: L("Days worked in the last 30", "直近30日の出勤日数"),
        };
      }
      return {
        title: L(`${p.count} new or rarely seen workers`, `新規・まれな作業者 ${p.count}名`),
        big: String(p.count),
        normal: L("0–2 days in the last 30", "直近30日で0〜2日"),
        text: L(`${list(names)}${moreText}.`, `${list(names, true)}${moreText}。`),
        check: L("New people make more mistakes. Check their NG rate and first-piece photos.", "新しい人はミスが起きやすいです。不良率と初物写真を確認してください。"),
        trendLabel: "",
        compareTitle: L("Records today", "本日の提出件数"),
      };
    }

    case "dataTotalMismatch":
      return {
        title: L(`${p.count} records don't add up`, `数量が合わないレコード ${p.count}件`),
        big: String(p.count),
        normal: L("Total should equal quantity − NG", "Total = 数量 − 不良 のはず"),
        text: L(
          `On these records the Total is not the quantity minus NG: ${fmtNum(p.diff)} pieces apart in total.`,
          `これらのレコードは Total が「数量 − 不良」と一致しません（差は合計${fmtNum(p.diff)}個）。`
        ),
        check: L(`Fix these before approval, or inventory will be off by ${fmtNum(p.diff)} pieces.`, `承認前に修正してください。修正しないと在庫が${fmtNum(p.diff)}個ずれます。`),
        trendLabel: "",
        compareTitle: L("Total entered vs quantity − NG", "入力された Total vs 数量 − 不良"),
      };

    case "dataTime":
      return {
        title: p.zero
          ? L(`${p.zero} of ${p.total} records show 0 minutes`, `${p.total}件中${p.zero}件が作業時間0分`)
          : L(`${p.long} record(s) longer than 10 hours`, `10時間を超えるレコード ${p.long}件`),
        big: p.zero ? `${p.zero} / ${p.total}` : String(p.long),
        normal: p.zero ? L("should be more than 0 min", "0分より長いはず") : L("a normal record is under 10 h", "通常は10時間未満"),
        text: p.zero
          ? L("Start time equals end time, so the cycle time is 0.", "開始時刻と終了時刻が同じため、サイクルタイムが0になっています。") +
            (p.long ? L(` ${p.long} more record(s) last over 10 hours.`, `ほかに10時間を超えるレコードが${p.long}件。`) : "")
          : L("The end time was probably entered on the wrong day, or the record was left open.", "終了時刻の入力ミスか、記録が開いたままだった可能性があります。"),
        check: p.zero
          ? L("If it is always the same tablet, the tablet is probably setting the start time when the record is submitted.", "毎回同じタブレットなら、提出時に開始時刻が設定されている可能性があります。")
          : L("Correct the times so cycle time and work hours are right.", "サイクルタイムと作業時間が正しくなるよう時刻を修正してください。"),
        trendLabel: "",
        compareTitle: L("Records with time problems", "時間に問題のあるレコード"),
      };

    case "dataApprovals": {
      const ap = p.approvers || [];
      return {
        title: L(`${p.waiting} of ${p.total} records are not approved yet`, `${p.total}件中${p.waiting}件が未承認`),
        big: fmtNum(p.waiting),
        normal:
          ap.length === 1
            ? L(`${p.approved} approved, all by ${ap[0].name}`, `承認済${p.approved}件（全て${ap[0].name}）`)
            : L(`${p.approved} approved`, `承認済${p.approved}件`),
        text: ap.length
          ? L(`Approved by: ${ap.map((a) => `${a.name} (${a.count})`).join(", ")}.`, `承認者：${ap.map((a) => `${a.name}（${a.count}）`).join("、")}。`)
          : L("No one has approved any records for this day yet.", "この日のレコードはまだ誰も承認していません。"),
        check: L("Who approves the rest? Unapproved records pile up quickly.", "残りは誰が承認しますか？未承認レコードはすぐに溜まります。"),
        trendLabel: "",
        compareTitle: L("Approved vs all records", "承認済 vs 全レコード"),
      };
    }

    case "flowOutput": {
      const up = p.ratio >= 1;
      const change = Math.round(Math.abs(p.ratio - 1) * 100);
      return {
        title: up
          ? L(`${p.factory} ${proc(p.process)} output ${change}% above normal`, `${p.factory}の${proc(p.process)}生産数が通常より${change}%多い`)
          : L(`${p.factory} ${proc(p.process)} output ${change}% below normal`, `${p.factory}の${proc(p.process)}生産数が通常より${change}%少ない`),
        big: fmtNum(p.today),
        normal: normally(L(`${fmtNum(p.base)} a day`, `${fmtNum(p.base)}個/日`)),
        text: L(`${p.records} records submitted.`, `提出件数 ${p.records}件。`),
        check: up
          ? L("Is the next process keeping up?", "後工程は追いついていますか？")
          : L("Was a line down, or were people moved elsewhere?", "ラインが止まっていたか、人員が別の作業に移っていましたか？"),
        trendLabel: L(`${p.factory} ${proc(p.process)} output per day`, `${p.factory} ${proc(p.process)}生産数（日別）`),
        compareTitle: L("Output today vs normal", "生産数 本日 vs 通常"),
      };
    }

    case "flowNotInspected":
      return {
        title: L(`${fmtNum(p.pressed)} pcs pressed but not inspected today`, `プレス済・本日未検査 ${fmtNum(p.pressed)}個`),
        big: fmtNum(p.pressed),
        normal: L(`${p.count} parts, largest ${p.top?.seban}`, `${p.count}品番（最大 ${p.top?.seban}）`),
        text: L(
          "These parts were pressed today and have no inspection record on the same day. Normal for one day; it matters if it keeps building up.",
          "本日プレスされ、同日の検査記録がない品番です。1日なら通常ですが、溜まり続ける場合は要注意です。"
        ),
        check: L("If these parts are inspected, check that the backlog clears in the next few days.", "検査対象の品番なら、数日以内に滞留が解消されるか確認してください。"),
        trendLabel: "",
        compareTitle: L("Pressed today (not inspected)", "本日プレス数（未検査）"),
      };

    default:
      return { title: f.type, big: "—", normal: "", text: "", check: "", trendLabel: "", compareTitle: "" };
  }
}

export function processLabel(key, isJa) {
  return PROCESS[key]?.[isJa ? "ja" : "en"] || key;
}
