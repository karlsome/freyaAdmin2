/**
 * firstFactoryPdfExport.js
 * Utility to generate and open A3 portrait production schedule PDF print view for First Factory (PSA2)
 */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function openFirstFactorySchedulePrintWindow({
  dateStr,
  startTime,
  scheduleWithTimes = [],
  data = [],
  scheduledBy = ""
}) {
  if (!scheduleWithTimes || scheduleWithTimes.length === 0) {
    alert("印刷するスケジュール項目がありません。(No items scheduled)");
    return;
  }

  const nextWindow = window.open("", "_blank");
  if (!nextWindow) {
    alert("ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。(Pop-up was blocked)");
    return;
  }

  // Helper to extract master info for a given hinban
  const getMasterInfo = (hinban) => {
    const found = data.find(d => d.hinban === hinban);
    const rawMaster = found?.materialInfo?.rawMaster || {};
    const hinmoku = rawMaster['品目マスタ'] || {};
    const segments = rawMaster['品番構造']?.segments || [];

    const kizaiSeg = segments.find(s => s.segment === '基材コード');
    const kizai = kizaiSeg?.name || kizaiSeg?.['得意先'] || kizaiSeg?.['入出荷先'] || rawMaster['基材コード'] || found?.kizai || '—';

    const shoriSeg = segments.find(s => s.segment === '処理コード');
    const shori = shoriSeg?.name || shoriSeg?.['得意先'] || shoriSeg?.['入出荷先'] || rawMaster['処理コード'] || found?.shori || '—';

    const colorSeg = segments.find(s => s.segment === '色コード');
    const color = colorSeg?.name || colorSeg?.['得意先'] || colorSeg?.['入出荷先'] || rawMaster['色コード'] || found?.color || '—';

    const habanagaSeg = segments.find(s => s.segment === '幅長コード');
    const habanaga = habanagaSeg?.name || habanagaSeg?.['得意先'] || habanagaSeg?.['入出荷先'] || rawMaster['幅長コード'] || found?.habanaga || '—';

    const shippingDest = hinmoku['出荷先名'] || hinmoku['入出荷先名'] || hinmoku['得意先名'] || found?.shippingDest || '—';
    const kataban = hinmoku['型番'] || '—';
    const zuban = hinmoku['図番'] || '—';
    const hinmei = hinmoku['品名'] || found?.hinmei || '—';
    const labelHinban = hinmoku['ラベル品番'] || found?.labelHinban || '—';

    return {
      kizai,
      shori,
      color,
      habanaga,
      shippingDest,
      kataban,
      zuban,
      hinmei,
      labelHinban
    };
  };

  let totalMeters = 0;
  let totalMins = 0;
  let rollCount = 0;
  let lastKizai = null;
  const rows = [];

  scheduleWithTimes.forEach((item, idx) => {
    totalMins += Number(item.duration) || 0;

    if (item.type === 'setup') {
      rows.push(`
        <tr class="setup-row">
          <td class="center font-bold">${idx + 1}</td>
          <td class="center font-bold time-cell">${escapeHtml(item.startTime)}<br><span class="text-sub">～ ${escapeHtml(item.endTime)}</span></td>
          <td colspan="7" class="left font-bold setup-name">⚙️ 段取り / 段替: ${escapeHtml(item.name || '段取')} (${item.duration}分)</td>
          <td class="center font-bold">—</td>
        </tr>
      `);
      lastKizai = null;
      return;
    }

    rollCount++;
    const meters = Number(item.meters) || 0;
    totalMeters += meters;
    const cmVal = meters * 100;
    const info = getMasterInfo(item.hinban);
    const currentKizai = info.kizai || item.kizai || '';

    // If 基材コード changes to a different one, insert a blank black separator row
    if (lastKizai !== null && lastKizai !== currentKizai) {
      rows.push(`
        <tr class="separator-black-row">
          <td colspan="10"></td>
        </tr>
      `);
    }
    lastKizai = currentKizai;

    // Clean shipping destination formatting (replace newlines with <br>)
    const formattedDest = escapeHtml(info.shippingDest).replace(/\n/g, '<br>');

    rows.push(`
      <tr class="item-row">
        <td class="center font-bold">${idx + 1}</td>
        <td class="center time-cell">
          <strong>${escapeHtml(item.startTime)}</strong><br>
          <span class="text-sub">～ ${escapeHtml(item.endTime)}</span>
        </td>
        <td class="center dest-cell">${formattedDest}</td>
        <td class="left kizai-cell">${escapeHtml(info.kizai)}</td>
        <td class="center shori-cell">${escapeHtml(info.shori)}</td>
        <td class="center color-cell">${escapeHtml(info.color)}</td>
        <td class="center habanaga-cell">${escapeHtml(info.habanaga)}</td>
        <td class="center kataban-cell">${escapeHtml(info.kataban)}</td>
        <td class="center roll-cell font-bold">${item.rollIndex || 1}/${item.totalRolls || 1}</td>
        <td class="right qty-cell font-bold">${cmVal.toLocaleString()} cm (${meters}m)</td>
      </tr>
    `);
  });

  const tableRows = rows.join("");

  const printTimeStr = new Date().toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const timeFormatted = `${hours}時間 ${mins}分 (${totalMins}分)`;

  const overallStartTime = scheduleWithTimes.length > 0 ? (scheduleWithTimes[0].startTime || startTime || '09:00') : (startTime || '09:00');
  const overallEndTime = scheduleWithTimes.length > 0 ? (scheduleWithTimes[scheduleWithTimes.length - 1].endTime || '—') : '—';
  const plannedTimeSpan = `${overallStartTime} ～ ${overallEndTime}`;

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>生産計画表 PSA2 - ${escapeHtml(dateStr)}</title>
        <style>
          @page {
            size: A3 portrait;
            margin: 12mm 10mm 12mm 10mm;
          }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
            font-size: 11pt;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sheet {
            width: 100%;
            padding: 10px;
          }
          .no-print-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 12px 18px;
            border-radius: 10px;
            margin-bottom: 16px;
          }
          .print-btn {
            background: #2563eb;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            padding: 8px 18px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .print-btn:hover {
            background: #1d4ed8;
          }
          .header-box {
            border-bottom: 2.5px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .main-title {
            margin: 0;
            font-size: 26pt;
            font-weight: 900;
            letter-spacing: 0.05em;
          }
          .sub-machine {
            font-size: 16pt;
            font-weight: 800;
            color: #1e293b;
            margin-left: 12px;
          }
          .meta-grid {
            display: flex;
            gap: 24px;
            margin-top: 8px;
            font-size: 11pt;
            font-weight: 700;
          }
          .meta-item {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .meta-item span.label {
            background: #f1f5f9;
            border: 1px solid #94a3b8;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 9.5pt;
          }
          .summary-strip {
            display: flex;
            justify-content: space-between;
            background: #f8fafc;
            border: 1.5px solid #000;
            border-bottom: none;
            padding: 6px 12px;
            font-size: 10.5pt;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 10.5pt;
          }
          th, td {
            border: 1.5px solid #000;
            padding: 6px 5px;
            vertical-align: middle;
            word-break: break-word;
          }
          th {
            background-color: #e2e8f0;
            font-weight: 900;
            text-align: center;
            font-size: 11pt;
            padding: 8px 4px;
          }
          tr.setup-row {
            background-color: #fffbeb !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          tr.separator-black-row td {
            background-color: #000000 !important;
            height: 6px !important;
            line-height: 6px !important;
            padding: 0 !important;
            border: 1.5px solid #000000 !important;
            box-shadow: inset 0 0 0 1000px #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .setup-name {
            color: #92400e;
            font-size: 11pt;
            padding-left: 14px;
          }
          .center { text-align: center; }
          .left { text-align: left; }
          .right { text-align: right; }
          .font-bold { font-weight: 700; }
          .text-sub {
            font-size: 8.5pt;
            color: #475569;
            font-weight: normal;
          }
          .time-cell { width: 9%; }
          .dest-cell { width: 14%; font-size: 10pt; }
          .kizai-cell { width: 24%; font-size: 10pt; font-weight: 700; }
          .shori-cell { width: 9%; font-size: 10pt; font-weight: 700; }
          .color-cell { width: 10%; font-size: 10pt; font-weight: 700; }
          .habanaga-cell { width: 10%; font-weight: 700; }
          .kataban-cell { width: 11%; font-weight: 700; }
          .qty-cell { width: 13%; }

          @media print {
            .no-print-bar { display: none !important; }
            .sheet { padding: 0; }
            html, body { width: 100%; height: 100%; }
            th {
              background-color: #e2e8f0 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            tr.setup-row {
              background-color: #fffbeb !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            tr.separator-black-row td {
              background-color: #000000 !important;
              height: 6px !important;
              line-height: 6px !important;
              padding: 0 !important;
              border: 1.5px solid #000000 !important;
              box-shadow: inset 0 0 0 1000px #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="no-print-bar">
            <div>
              <strong>🖨️ 印刷プレビュー (Print Preview)</strong> - A3 縦向き (Portrait)
            </div>
            <button class="print-btn" onclick="window.print()">
              <span>印刷する (Print PDF)</span>
            </button>
          </div>

          <div class="header-box">
            <div class="header-top">
              <div>
                <span class="main-title">生産計画</span>
                <span class="sub-machine">/ PSA2 (1号機)</span>
              </div>
              <div style="text-align: right; font-size: 10pt; color: #334155;">
                印刷日時: <strong>${escapeHtml(printTimeStr)}</strong>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-item">
                <span class="label">日付</span>
                <span>${escapeHtml(dateStr)}</span>
              </div>
              <div class="meta-item">
                <span class="label">予定時</span>
                <span><strong>${escapeHtml(plannedTimeSpan)}</strong> (${escapeHtml(timeFormatted)})</span>
              </div>
              <div class="meta-item">
                <span class="label">作成者</span>
                <span>${escapeHtml(scheduledBy || 'Unknown user')}</span>
              </div>
              <div class="meta-item">
                <span class="label">工場</span>
                <span>第一工場</span>
              </div>
            </div>
          </div>

          <div class="summary-strip">
            <span>予定時: <strong>${escapeHtml(plannedTimeSpan)}</strong> (${escapeHtml(timeFormatted)})</span>
            <span>予定総巻数: <strong>${rollCount} 巻き</strong> (${scheduleWithTimes.length} 工程)</span>
            <span>予定総生産量: <strong>${totalMeters.toLocaleString()} m</strong> (${(totalMeters * 100).toLocaleString()} cm)</span>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%;">No.</th>
                <th style="width: 9%;">時間</th>
                <th style="width: 14%;">出荷先名</th>
                <th style="width: 24%;">基材コード</th>
                <th style="width: 9%;">処理コード</th>
                <th style="width: 10%;">色コード</th>
                <th style="width: 10%;">幅長コード</th>
                <th style="width: 11%;">型番</th>
                <th style="width: 13%;">生産数量</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;

  nextWindow.document.write(html);
  nextWindow.document.close();
}
