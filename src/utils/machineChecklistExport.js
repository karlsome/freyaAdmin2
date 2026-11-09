/**
 * machineChecklistExport.js
 * Generates Traditional (紙台帳風) and Digital (デジタル風) PDF print views and CSV exports
 * for individual machine checklist records.
 */

function normalizeId(id) {
  if (!id) return "";
  if (typeof id === "object" && id.$oid) return id.$oid;
  return String(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Extracts and consolidates all check fields and daily submission results for a machine across dates.
 * Groups steps and worker names under their respective checklist form titles (Daily -> Weekly -> Monthly).
 */
export function buildMachineChecklistMatrix({
  machine,
  templates = [],
  records = [],
  dates = [],
  equipmentMap = null,
  language = "ja",
  tickets = [],
}) {
  const isEn = language === "en";
  const machineId = normalizeId(machine.id || machine._id);
  const machineName = String(machine.name || machine.設備名 || "").trim();
  const factory = String(machine.factory || machine.工場 || "—").trim();
  // Leave 設備No. blank for now as requested
  const setsubiNo = "";

  // 1. Identify all templates assigned to this machine
  const assignedTemplates = templates.filter((template) => {
    const eqIds = Array.isArray(template.equipmentIds) ? template.equipmentIds.map(normalizeId) : [];
    if (eqIds.includes(machineId)) return true;
    if (template.工場 && template.工場 === factory && !eqIds.length) return true;
    return false;
  });

  // Fallback to all active templates if none specifically matched
  const effectiveTemplates = assignedTemplates.length > 0 ? assignedTemplates : templates;

  // Sort templates: Daily -> Weekly -> Monthly (multiple daily forms queued together)
  const SCHEDULE_WEIGHT = {
    daily: 1,
    weekly: 2,
    monthly: 3,
  };

  const sortedTemplates = [...effectiveTemplates].sort((a, b) => {
    const weightA = SCHEDULE_WEIGHT[a.schedule] || 99;
    const weightB = SCHEDULE_WEIGHT[b.schedule] || 99;
    if (weightA !== weightB) return weightA - weightB;
    return String(a.name || "").localeCompare(String(b.name || ""), "ja");
  });

  // 2. Collect unique fields across all sorted templates and group by form sections
  const fieldList = [];
  const formSections = [];
  const seenFieldKeys = new Set();
  let globalItemIndex = 1;

  sortedTemplates.forEach((tpl) => {
    const formId = normalizeId(tpl._id || tpl.id);
    const scheduleLabel = isEn
      ? (tpl.schedule === "daily" ? "Daily" : tpl.schedule === "weekly" ? "Weekly" : tpl.schedule === "monthly" ? "Monthly" : "Periodic")
      : (tpl.schedule === "daily" ? "日常・始業" : tpl.schedule === "weekly" ? "週次" : tpl.schedule === "monthly" ? "月次" : "定期");
    const formTitle = isEn ? (tpl.name_en || tpl.name || "Checklist") : (tpl.name_ja || tpl.name || "点検");
    const rawFields = Array.isArray(tpl.fields) ? tpl.fields : [];
    const sectionFields = [];

    rawFields.forEach((field, fIndex) => {
      if (field.type === "name") return; // Skip operator name field as it is a header field

      const fieldKey = `${formId}_${field.id || fIndex}`;
      if (seenFieldKeys.has(fieldKey)) return;
      seenFieldKeys.add(fieldKey);

      // Prioritize description based on selected language
      let standard = isEn
        ? String(field.description_en || field.description || field.description_ja || field.standard || field.specification || field.criteria || "").trim()
        : String(field.description_ja || field.description || field.description_en || field.standard || field.specification || field.criteria || "").trim();
      if (!standard && field.type === "range") {
        if (field.min !== undefined && field.max !== undefined) {
          standard = `${field.min} ～ ${field.max}${field.unit ? ` ${field.unit}` : ""}`;
        }
      }
      if (!standard && isEn && field.description_ja) {
        standard = String(field.description_ja).trim();
      }
      if (!standard && !isEn && field.description_en) {
        standard = String(field.description_en).trim();
      }
      if (!standard && field.type === "toggle") {
        standard = isEn ? "Normal / No abnormalities" : "異常なきこと / 正常";
      }

      let method = isEn ? "◯✕ (OK/NG)" : "◯✕";
      if (field.type === "range" || field.type === "number") method = isEn ? "Measured Value" : "実測値";
      else if (field.type === "text") method = isEn ? "Text" : "記入";

      const itemLabel = isEn
        ? (field.label_en || field.label || field.label_ja || `Item ${fIndex + 1}`)
        : (field.label_ja || field.label || field.label_en || `項目 ${fIndex + 1}`);

      const item = {
        id: field.id || `f_${fIndex}`,
        index: globalItemIndex++,
        schedule: tpl.schedule || "daily",
        scheduleLabel,
        formId,
        formName: formTitle,
        label: itemLabel,
        standard: standard || (isEn ? "Normal / No abnormalities" : "異常なきこと / 正常"),
        method,
        type: field.type,
        imageURL: field.imageURL || field.imageUrl || "",
      };

      sectionFields.push(item);
      fieldList.push(item);
    });

    if (sectionFields.length > 0) {
      formSections.push({
        formId,
        formName: formTitle,
        schedule: tpl.schedule || "daily",
        scheduleLabel,
        fields: sectionFields,
      });
    }
  });

  const recordsByDate = new Map();
  const machineSubmissions = [];
  const targetDateSet = new Set(dates.map((d) => formatDateKey(d)));

  records.forEach((rec) => {
    const recMachineId = normalizeId(rec.machineId || rec.equipmentId);
    const recMachineName = String(rec.machineName || "").trim();
    if (recMachineId && machineId && recMachineId !== machineId && recMachineName !== machineName) {
      return;
    }

    if (!rec.completedAt) return;
    const dateKey = formatDateKey(rec.completedAt);
    const list = recordsByDate.get(dateKey) || [];
    list.push(rec);
    recordsByDate.set(dateKey, list);

    if (targetDateSet.size > 0 && !targetDateSet.has(dateKey)) return;

    const formId = normalizeId(rec.formId || rec.templateId);
    const matchedTemplate = templates.find((t) => normalizeId(t._id || t.id) === formId);
    const formTitle = isEn
      ? (matchedTemplate?.name_en || matchedTemplate?.name || rec.formName_en || rec.formName || "Checklist")
      : (matchedTemplate?.name_ja || matchedTemplate?.name || rec.formName_ja || rec.formName || "点検フォーム");

    const schedule = matchedTemplate?.schedule || rec.schedule || "daily";
    const scheduleLabel = isEn
      ? (schedule === "daily" ? "Daily" : schedule === "weekly" ? "Weekly" : schedule === "monthly" ? "Monthly" : "Periodic")
      : (schedule === "daily" ? "日常・始業" : schedule === "weekly" ? "週次" : schedule === "monthly" ? "月次" : "定期");

    let operators = "";
    if (Array.isArray(rec.workerName)) {
      operators = rec.workerName
        .map((w) => (typeof w === "object" ? (w.name || w.Name || "") : String(w).trim()))
        .filter(Boolean)
        .join(", ");
    } else if (rec.completedBy) {
      operators = String(rec.completedBy).trim();
    }

    const recId = normalizeId(rec._id || rec.recordId);
    const matchingTickets = Array.isArray(tickets)
      ? tickets.filter((t) => normalizeId(t.recordId || t.checkFormRecordId || t.checkFormRecordID) === recId)
      : [];
    const defectTickets = matchingTickets.filter((t) => !t.isOptional && t.ticketType !== "optional");
    const optionalTickets = matchingTickets.filter((t) => t.isOptional || t.ticketType === "optional");

    machineSubmissions.push({
      recordId: recId,
      completedAt: rec.completedAt,
      dateKey,
      formId,
      formName: formTitle,
      schedule,
      scheduleLabel,
      operators: operators || "—",
      hasNG: rec.hasNG || defectTickets.length > 0,
      defectCount: defectTickets.length,
      optionalCount: optionalTickets.length,
      defectTickets,
      optionalTickets,
      answersCount: Array.isArray(rec.answers) ? rec.answers.length : 0,
    });
  });

  machineSubmissions.sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

  const formattedTickets = (Array.isArray(tickets) ? tickets : []).map((ticket, tIdx) => {
    const isOpt = ticket.isOptional === true || String(ticket.ticketType).toLowerCase() === "optional";
    const templateField = fieldList.find((f) => String(f.id) === String(ticket.fieldId)) || {};
    const fieldLabel = isEn
      ? (ticket.fieldLabel_en || templateField.label || ticket.fieldLabel || `Item ${tIdx + 1}`)
      : (ticket.fieldLabel_ja || templateField.label || ticket.fieldLabel || `項目 ${tIdx + 1}`);

    const formTitle = isEn
      ? (ticket.formName_en || ticket.formName || "Checklist")
      : (ticket.formName_ja || ticket.formName || "点検");

    const reason = isEn
      ? (ticket.reason_en || ticket.reason || (isOpt ? "Optional Note" : "No reason provided"))
      : (ticket.reason_ja || ticket.reason || (isOpt ? "申し送り事項" : "理由の記載なし"));

    const fixReason = isEn
      ? (ticket.fixReason_en || ticket.fixReason || "")
      : (ticket.fixReason_ja || ticket.fixReason || "");

    const isClosed = String(ticket.status || "").toLowerCase() === "closed" || String(ticket.status || "").toLowerCase() === "fixed";

    return {
      ticketNo: ticket.ticketNo || tIdx + 1,
      ticketType: isOpt ? "optional" : "defect",
      isOptional: isOpt,
      isDefect: !isOpt,
      fieldId: ticket.fieldId,
      fieldLabel,
      formName: formTitle,
      workerName: ticket.completedBy || (Array.isArray(ticket.workerName) ? ticket.workerName.join(", ") : ticket.workerName) || "—",
      answerValue: ticket.answerValue || "—",
      reason,
      imageURLs: Array.isArray(ticket.imageURLs) ? ticket.imageURLs.filter(Boolean) : [],
      createdAt: ticket.createdAt,
      isClosed,
      closedAt: ticket.closedAt,
      closedBy: ticket.closedBy || ticket.closedByUsername || "",
      fixReason,
    };
  });

  const dateColumns = dates.map((dateObj) => {
    const dateKey = formatDateKey(dateObj);
    const dayRecords = recordsByDate.get(dateKey) || [];
    const dayNumber = new Date(dateObj).getDate();
    const dayOfWeek = new Date(dateObj).toLocaleDateString(isEn ? "en-US" : "ja-JP", { weekday: "short" });

    const fieldResults = {};
    const formResults = {};
    const allOperators = new Set();
    let hasAnySubmission = dayRecords.length > 0;
    let hasNG = false;

    formSections.forEach((sec) => {
      formResults[sec.formId] = {
        operators: new Set(),
        hasSubmission: false,
        hasNG: false,
      };
    });

    dayRecords.forEach((rec) => {
      const recFormId = normalizeId(rec.formId || rec.templateId);
      const targetFormRes = formResults[recFormId];

      if (rec.completedBy) {
        const workerName = String(rec.completedBy).trim();
        if (workerName) {
          allOperators.add(workerName);
          if (targetFormRes) {
            targetFormRes.operators.add(workerName);
          }
        }
      }

      if (targetFormRes) {
        targetFormRes.hasSubmission = true;
      }

      if (rec.hasNG) {
        hasNG = true;
        if (targetFormRes) {
          targetFormRes.hasNG = true;
        }
      }

      if (Array.isArray(rec.answers)) {
        rec.answers.forEach((ans) => {
          const fid = ans.id || ans.fieldId;
          if (fid) {
            const isNg = ans.status === "ng" || ans.status === "out-of-range" || String(ans.value).toUpperCase() === "NG";
            fieldResults[fid] = {
              value: ans.value !== undefined ? ans.value : ans.displayValue,
              status: isNg ? "NG" : (ans.status || "OK"),
              isNG: isNg,
            };
          }
        });
      }

      if (rec.responses && typeof rec.responses === "object") {
        Object.entries(rec.responses).forEach(([fid, val]) => {
          const isNg = String(val).toLowerCase() === "ng";
          if (!fieldResults[fid]) {
            fieldResults[fid] = {
              value: val,
              status: isNg ? "NG" : "OK",
              isNG: isNg,
            };
          }
        });
      }
    });

    const formattedFormResults = {};
    Object.entries(formResults).forEach(([fId, data]) => {
      formattedFormResults[fId] = {
        hasSubmission: data.hasSubmission,
        hasNG: data.hasNG,
        operators: Array.from(data.operators).join(", "),
      };
    });

    return {
      dateKey,
      dayNumber,
      dayOfWeek,
      hasAnySubmission,
      hasNG,
      operators: Array.from(allOperators).join(", "),
      formResults: formattedFormResults,
      fieldResults,
    };
  });

  return {
    machine: {
      id: machineId,
      name: machineName,
      factory,
      setsubiNo,
    },
    fields: fieldList,
    formSections,
    dateColumns,
    submissions: machineSubmissions,
    tickets: formattedTickets,
    totalSubmissions: machineSubmissions.length || records.length,
    language,
  };
}

/**
 * Traditional Japanese Paper Checklist (紙台帳風フォーマット)
 * Modeled accurately after factory maintenance binders (設備点検記録)
 */
export function openTraditionalChecklistPrintWindow(matrixData, periodLabel = "") {
  const { machine, fields, formSections, dateColumns } = matrixData;
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("ポップアップがブロックされました。ブラウザでポップアップを許可してください。");
    return;
  }

  const photoFields = fields.filter((f) => f.imageURL);

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>設備点検記録_${escapeHtml(machine.name)}_${escapeHtml(periodLabel)}</title>
  <style>
    @page {
      size: A3 landscape;
      margin: 5mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 6px;
      color: #111;
      background: #fff;
      font-family: "Helvetica Neue", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif;
      font-size: 8pt;
      line-height: 1.2;
    }
    .no-print {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 10px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .print-btn {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 13px;
      cursor: pointer;
    }
    .print-btn:hover { background: #1d4ed8; }

    .sheet {
      width: 100%;
      background: #fff;
    }

    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    .header-table td {
      vertical-align: middle;
      padding: 2px 4px;
    }
    .main-title {
      font-size: 14pt;
      font-weight: 800;
      letter-spacing: 0.1em;
      border-bottom: 2px solid #000;
      padding-bottom: 2px;
      display: inline-block;
    }
    .meta-box {
      border: 1px solid #333;
      padding: 3px 8px;
      font-size: 8.5pt;
      font-weight: bold;
      display: inline-block;
      border-radius: 2px;
    }
    .meta-value {
      font-size: 10pt;
      font-weight: 900;
      margin-left: 4px;
    }

    .grid-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
      table-layout: fixed;
    }
    .grid-table th, .grid-table td {
      border: 1px solid #333;
      padding: 3px 2px;
      text-align: center;
      vertical-align: middle;
      word-break: break-all;
    }
    .grid-table th {
      background-color: #f1f5f9;
      font-weight: bold;
    }
    .col-code { width: 28px; }
    .col-cat { width: 55px; }
    .col-label { width: 170px; text-align: left !important; padding-left: 4px !important; }
    .col-standard { width: 190px; text-align: left !important; padding-left: 4px !important; }
    .col-method { width: 45px; }
    .day-col {
      width: calc((100% - 488px) / ${dateColumns.length});
      min-width: 18px;
      max-width: 28px;
      padding: 1px 0 !important;
      font-size: 7pt;
    }
    .day-header {
      font-size: 7.5pt;
      background: #e2e8f0;
    }
    .day-weekday {
      font-size: 6.5pt;
      background: #f8fafc;
    }
    .val-ok {
      color: #16a34a;
      font-weight: bold;
      font-size: 9pt;
    }
    .val-ng {
      color: #dc2626;
      font-weight: 900;
      font-size: 9.5pt;
      background-color: #fee2e2 !important;
    }
    .val-text {
      font-size: 6.5pt;
      font-weight: bold;
    }
    .form-section-header-row td {
      background-color: #e2e8f0 !important;
      text-align: left !important;
      padding: 4px 8px !important;
      font-weight: bold;
      font-size: 8.5pt;
      border-top: 2px solid #000;
    }
    .form-section-badge {
      display: inline-block;
      background: #1e293b;
      color: #fff;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 7pt;
      margin-right: 6px;
    }
    .supervisor-row td {
      border-top: 2px solid #333;
      font-weight: bold;
    }
    .supervisor-title {
      text-align: right !important;
      padding-right: 8px !important;
      font-size: 7.5pt;
    }

    .photo-section {
      margin-top: 10px;
      page-break-inside: avoid;
    }
    .photo-title {
      font-size: 8.5pt;
      font-weight: bold;
      margin-bottom: 4px;
      border-left: 3px solid #2563eb;
      padding-left: 6px;
    }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 6px;
    }
    .photo-card {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
      background: #fff;
      text-align: center;
      padding: 2px;
    }
    .photo-card img {
      width: 100%;
      height: 55px;
      object-fit: cover;
      display: block;
      border-radius: 2px;
    }
    .photo-tag {
      font-size: 6pt;
      color: #334155;
      font-weight: bold;
      margin-top: 1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div>
      <strong>設備点検記録（紙台帳スタイル）</strong> - ${escapeHtml(machine.name)} (${escapeHtml(machine.factory)}) [${escapeHtml(periodLabel)}]
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ 印刷 / PDF保存 (Print / Save as PDF)</button>
  </div>

  <div class="sheet">
    <table class="header-table">
      <tr>
        <td style="width: 40%;">
          <span class="main-title">設備点検記録（日常）</span>
        </td>
        <td style="width: 20%; text-align: center;">
          <span class="meta-box">設備No. <span class="meta-value">${escapeHtml(machine.setsubiNo || "")}</span></span>
        </td>
        <td style="width: 20%;">
          <span class="meta-box">設備名: <span class="meta-value">${escapeHtml(machine.name)}</span></span>
        </td>
        <td style="width: 20%; text-align: right;">
          <span class="meta-box">工場: <span class="meta-value">${escapeHtml(machine.factory)}</span></span>
        </td>
      </tr>
    </table>

    <table class="grid-table">
      <thead>
        <tr>
          <th class="col-code" rowspan="2">符号</th>
          <th class="col-cat" rowspan="2">点検区分</th>
          <th class="col-label" rowspan="2">点検箇所／項目</th>
          <th class="col-standard" rowspan="2">管理規格</th>
          <th class="col-method" rowspan="2">記入方法</th>
          ${dateColumns.map((col) => `
            <th class="day-col day-header">${col.dayNumber}</th>
          `).join("")}
        </tr>
        <tr>
          ${dateColumns.map((col) => `
            <th class="day-col day-weekday">${col.dayOfWeek}</th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${formSections.map((section) => `
          <tr class="form-section-header-row">
            <td colspan="${5 + dateColumns.length}">
              <span class="form-section-badge">${escapeHtml(section.scheduleLabel)}</span>
              <strong>${escapeHtml(section.formName)}</strong>
            </td>
          </tr>
          ${section.fields.map((f) => `
            <tr>
              <td class="col-code font-bold">${f.index}</td>
              <td class="col-cat font-bold">${escapeHtml(f.scheduleLabel)}</td>
              <td class="col-label">${escapeHtml(f.label)}</td>
              <td class="col-standard">${escapeHtml(f.standard)}</td>
              <td class="col-method">${escapeHtml(f.method)}</td>
              ${dateColumns.map((col) => {
                const res = col.fieldResults[f.id];
                if (!res) return `<td class="day-col">—</td>`;
                if (res.isNG) return `<td class="day-col val-ng">✕</td>`;
                if (f.type === "toggle" || f.type === "check" || !res.value || res.value === "OK" || res.value === "ok") {
                  return `<td class="day-col val-ok">◯</td>`;
                }
                return `<td class="day-col val-text">${escapeHtml(res.value)}</td>`;
              }).join("")}
            </tr>
          `).join("")}
        `).join("")}
      </tbody>
    </table>

    ${photoFields.length > 0 ? `
      <div class="photo-section">
        <div class="photo-title">【参考ガイド写真】</div>
        <div class="photo-grid">
          ${photoFields.map((f) => `
            <div class="photo-card">
              <img src="${escapeHtml(f.imageURL)}" alt="${escapeHtml(f.label)}" />
              <div class="photo-tag" title="${escapeHtml(f.label)}"><strong>${f.index}.</strong> ${escapeHtml(f.label)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Modern Digital Checklist PDF (デジタル管理報告書)
 * Flat, high-contrast, crystal-clear executive report designed for senior plant managers and executives.
 */
export function openDigitalChecklistPrintWindow(matrixData, periodLabel = "") {
  const { machine, fields, formSections, dateColumns, submissions = [], tickets = [], language = "ja" } = matrixData;
  const isEn = language === "en";

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert(isEn ? "Pop-up blocked. Please allow pop-ups for this site." : "ポップアップがブロックされました。ブラウザでポップアップを許可してください。");
    return;
  }

  let totalCheckedSlots = 0;
  let totalOKSlots = 0;

  dateColumns.forEach((col) => {
    Object.values(col.fieldResults).forEach((res) => {
      totalCheckedSlots += 1;
      if (!res.isNG) totalOKSlots += 1;
    });
  });

  const totalSubmissionsCount = submissions.length || dateColumns.filter((c) => c.hasAnySubmission).length;
  const daysWithSubmissions = dateColumns.filter((c) => c.hasAnySubmission).length;
  const completionRate = dateColumns.length > 0 ? Math.round((daysWithSubmissions / dateColumns.length) * 100) : 0;
  const defectTicketsCount = tickets.filter((t) => t.isDefect).length;
  const optionalTicketsCount = tickets.filter((t) => t.isOptional).length;
  const passRate = totalCheckedSlots > 0 ? Math.round((totalOKSlots / totalCheckedSlots) * 100) : 100;

  const nowFormatted = new Date().toLocaleString(isEn ? "en-US" : "ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `<!DOCTYPE html>
<html lang="${isEn ? "en" : "ja"}">
<head>
  <meta charset="UTF-8">
  <title>${isEn ? "Digital_Executive_Report" : "設備点検デジタル管理報告書"}_${escapeHtml(machine.name)}_${escapeHtml(periodLabel)}</title>
  <style>
    @page {
      size: A3 landscape;
      margin: 8mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
      margin: 0;
      padding: 16px;
      color: #0f172a;
      background: #f1f5f9;
      font-size: 9pt;
      line-height: 1.35;
    }
    .no-print {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #fff;
      padding: 12px 20px;
      border-radius: 10px;
      margin-bottom: 16px;
    }
    .print-btn {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 10px 22px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13.5px;
      cursor: pointer;
    }
    .print-btn:hover { background: #1d4ed8; }

    .sheet {
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 24px;
    }

    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .title-area h1 {
      margin: 0;
      font-size: 18pt;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .title-area p {
      margin: 4px 0 0 0;
      color: #475569;
      font-size: 9.5pt;
      font-weight: 600;
    }
    .machine-badge-box {
      border: 2px solid #2563eb;
      background: #eff6ff;
      padding: 8px 16px;
      border-radius: 8px;
      text-align: right;
    }
    .machine-title {
      font-size: 13pt;
      font-weight: 900;
      color: #1e40af;
    }
    .machine-sub {
      font-size: 8pt;
      font-weight: 700;
      color: #3b82f6;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 22px;
    }
    .kpi-box {
      border: 1.5px solid #cbd5e1;
      background: #f8fafc;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .kpi-box-defect {
      border-color: #f87171 !important;
      background: #fef2f2 !important;
    }
    .kpi-box-optional {
      border-color: #93c5fd !important;
      background: #eff6ff !important;
    }
    .kpi-title {
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
    }
    .kpi-value {
      font-size: 20pt;
      font-weight: 900;
      margin: 2px 0;
      line-height: 1.1;
      color: #0f172a;
    }
    .kpi-sub {
      font-size: 7.5pt;
      font-weight: 600;
      color: #64748b;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #fff;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 9.5pt;
      font-weight: 800;
      margin: 20px 0 10px 0;
    }
    .section-note {
      font-size: 7.5pt;
      font-weight: normal;
      opacity: 0.85;
    }

    .flat-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 16px;
      border: 1px solid #cbd5e1;
    }
    .flat-table th {
      background: #e2e8f0;
      color: #0f172a;
      font-weight: 800;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
    }
    .flat-table td {
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    .flat-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }

    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 800;
      text-align: center;
    }
    .pill-ok { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .pill-defect { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .pill-opt { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
    .pill-neutral { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

    .findings-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .finding-card {
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      overflow: hidden;
    }
    .finding-card-defect { border-color: #ef4444; }
    .finding-card-optional { border-color: #3b82f6; }
    .finding-card-header {
      padding: 6px 12px;
      font-weight: 800;
      font-size: 8.5pt;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
    }
    .finding-card-header-defect { background: #fee2e2; color: #991b1b; }
    .finding-card-header-optional { background: #dbeafe; color: #1e40af; }
    .finding-body { padding: 10px 12px; display: flex; gap: 12px; }
    .finding-info { flex: 1; min-width: 0; }
    .finding-item-title { font-size: 9.5pt; font-weight: 800; margin-bottom: 4px; }
    .finding-meta { font-size: 7.5pt; color: #475569; margin-bottom: 6px; }
    .reason-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 8px; font-size: 8pt; margin-bottom: 6px; }
    .fix-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 6px 8px; font-size: 7.5pt; color: #166534; }
    .pending-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 4px 8px; font-size: 7.5pt; color: #92400e; font-weight: 700; }
    .finding-photo { width: 140px; height: 95px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; }
    .no-findings-banner { border: 1.5px dashed #86efac; background: #f0fdf4; color: #166534; padding: 14px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 9.5pt; }

    @media print {
      .no-print { display: none !important; }
      body { padding: 0; background: #fff; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div><strong>${isEn ? "Digital Executive Report" : "設備点検デジタル管理報告書"}</strong> - ${escapeHtml(machine.name)}</div>
    <button class="print-btn" onclick="window.print()">🖨️ ${isEn ? "Print" : "印刷"}</button>
  </div>
  <div class="sheet">
    <!-- Top Header -->
    <div class="header-bar">
      <div class="title-area">
        <h1>${isEn ? "Equipment Inspection Executive Report" : "設備点検 総合実績管理報告書"}</h1>
        <p>
          ${isEn ? "Period" : "対象期間"}: <strong>${escapeHtml(periodLabel)}</strong> • 
          ${isEn ? "Factory" : "工場"}: <strong>${escapeHtml(machine.factory)}</strong> • 
          ${isEn ? "Generated" : "出力日時"}: ${nowFormatted}
        </p>
      </div>
      <div class="machine-badge-box">
        <div class="machine-title">⚙️ ${escapeHtml(machine.name)}</div>
        <div class="machine-sub">${isEn ? "Registered Checklists" : "登録点検数"}: ${formSections.length} ${isEn ? "forms" : "種"}</div>
      </div>
    </div>

    <!-- 4 Flat High-Contrast KPI Boxes -->
    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-title">📋 ${isEn ? "Total Checklists Conducted" : "総点検実施数"}</div>
        <div class="kpi-value">${totalSubmissionsCount} <span style="font-size: 11pt; font-weight: 700;">${isEn ? "times" : "回"}</span></div>
        <div class="kpi-sub">${isEn ? `Checked on ${daysWithSubmissions} of ${dateColumns.length} days (${completionRate}%)` : `${dateColumns.length}日中 ${daysWithSubmissions}日 実施 (実施率: ${completionRate}%)`}</div>
      </div>

      <div class="kpi-box">
        <div class="kpi-title">🟢 ${isEn ? "Inspected Items (Normal / OK)" : "点検項目 合格数 (OK)"}</div>
        <div class="kpi-value" style="color: #16a34a;">${totalOKSlots} <span style="font-size: 11pt; font-weight: 700;">${isEn ? "items" : "項目"}</span></div>
        <div class="kpi-sub">${isEn ? `Overall Pass Rate: ${passRate}%` : `全体合格率: ${passRate}%`}</div>
      </div>

      <div class="kpi-box ${defectTicketsCount > 0 ? "kpi-box-defect" : ""}">
        <div class="kpi-title" style="color: ${defectTicketsCount > 0 ? "#b91c1c" : "#475569"};">⚠️ ${isEn ? "Defect Tickets" : "不具合指摘件数"}</div>
        <div class="kpi-value" style="color: ${defectTicketsCount > 0 ? "#dc2626" : "#0f172a"};">${defectTicketsCount} <span style="font-size: 11pt; font-weight: 700;">${isEn ? "cases" : "件"}</span></div>
        <div class="kpi-sub">${defectTicketsCount > 0 ? (isEn ? "Immediate / Closed Actions" : "要対応または処置完了") : (isEn ? "No defects reported" : "異常指摘なし (良好)")}</div>
      </div>

      <div class="kpi-box ${optionalTicketsCount > 0 ? "kpi-box-optional" : ""}">
        <div class="kpi-title" style="color: ${optionalTicketsCount > 0 ? "#1d4ed8" : "#475569"};">💬 ${isEn ? "Optional Shift Notes" : "申し送り・特記事項"}</div>
        <div class="kpi-value" style="color: ${optionalTicketsCount > 0 ? "#2563eb" : "#0f172a"};">${optionalTicketsCount} <span style="font-size: 11pt; font-weight: 700;">${isEn ? "notes" : "件"}</span></div>
        <div class="kpi-sub">${isEn ? "Worker communications" : "現場からの情報共有・連絡"}</div>
      </div>
    </div>

    <!-- Section 1: Chronological Daily Inspection Submissions Log -->
    <div class="section-header">
      <span>📅 1. ${isEn ? "Inspection Submissions Chronological Log" : "日付・点検別 実施ログ一覧"} (${submissions.length} ${isEn ? "records" : "件"})</span>
      <span class="section-note">${isEn ? "Covers all checks conducted on this machine per day" : "同一設備で1日に複数回実施された点検を含む全記録"}</span>
    </div>

    <table class="flat-table">
      <thead>
        <tr>
          <th style="width: 110px;">${isEn ? "Date & Time" : "実施日時"}</th>
          <th style="width: 200px;">${isEn ? "Checklist Form" : "点検区分・フォーム名"}</th>
          <th style="width: 140px;">${isEn ? "Operator / Inspector" : "担当作業者"}</th>
          <th style="width: 120px; text-align: center;">${isEn ? "Overall Result" : "総合判定"}</th>
          <th style="width: 110px; text-align: center;">${isEn ? "Findings" : "指摘 / 申し送り"}</th>
          <th>${isEn ? "Summary & Details" : "特記事項・備考"}</th>
        </tr>
      </thead>
      <tbody>
        ${submissions.length === 0 ? `
          <tr>
            <td colspan="6" style="text-align: center; color: #64748b; padding: 14px;">
              ${isEn ? "No checklist submissions recorded for this machine during the selected period." : "対象期間中にこの設備での点検提出記録はありません。"}
            </td>
          </tr>
        ` : submissions.map((sub) => {
          const dateStr = new Date(sub.completedAt).toLocaleString(isEn ? "en-US" : "ja-JP", {
            month: "numeric",
            day: "numeric",
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          });

          let resultPill = `<span class="pill pill-ok">🟢 ${isEn ? "Normal (OK)" : "正常完了 (OK)"}</span>`;
          if (sub.defectCount > 0) {
            resultPill = `<span class="pill pill-defect">⚠️ ${isEn ? `Defect (${sub.defectCount})` : `不具合あり (${sub.defectCount}件)`}</span>`;
          } else if (sub.optionalCount > 0) {
            resultPill = `<span class="pill pill-opt">💬 ${isEn ? `Note (${sub.optionalCount})` : `申し送り (${sub.optionalCount}件)`}</span>`;
          }

          let findingsLabel = "—";
          if (sub.defectCount > 0 && sub.optionalCount > 0) {
            findingsLabel = `<span style="color: #dc2626; font-weight: bold;">不具合 ${sub.defectCount}</span> / <span style="color: #2563eb; font-weight: bold;">申し送り ${sub.optionalCount}</span>`;
          } else if (sub.defectCount > 0) {
            findingsLabel = `<span style="color: #dc2626; font-weight: bold;">⚠️ 不具合 ${sub.defectCount}件</span>`;
          } else if (sub.optionalCount > 0) {
            findingsLabel = `<span style="color: #2563eb; font-weight: bold;">💬 申し送り ${sub.optionalCount}件</span>`;
          }

          const ticketRemarks = [
            ...sub.defectTickets.map((t) => `【不具合 #${t.ticketNo || ""}】${t.fieldLabel || ""}: ${t.reason || ""}`),
            ...sub.optionalTickets.map((t) => `【申し送り #${t.ticketNo || ""}】${t.fieldLabel || ""}: ${t.reason || ""}`),
          ];

          return `
            <tr>
              <td style="font-weight: 700; white-space: nowrap;">${dateStr}</td>
              <td>
                <span class="pill pill-neutral" style="font-size: 7pt; margin-right: 4px;">${escapeHtml(sub.scheduleLabel)}</span>
                <strong>${escapeHtml(sub.formName)}</strong>
              </td>
              <td style="font-weight: 600;">👤 ${escapeHtml(sub.operators)}</td>
              <td style="text-align: center;">${resultPill}</td>
              <td style="text-align: center;">${findingsLabel}</td>
              <td style="color: #334155;">
                ${ticketRemarks.length > 0
                  ? ticketRemarks.map((r) => `<div style="margin-bottom: 2px;">${escapeHtml(r)}</div>`).join("")
                  : (isEn ? "All items normal" : "異常なし")}
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>

    <!-- Section 2: Defect & Optional Notes Findings with Photos -->
    <div class="section-header">
      <span>📸 2. ${isEn ? "Incident & Finding Details with Photos" : "異常・不具合 & 申し送り 写真付き詳細"} (${tickets.length} ${isEn ? "items" : "件"})</span>
      <span class="section-note">${isEn ? "Field notes, reported photos, and resolution actions" : "現場からの報告写真と処置メモ"}</span>
    </div>

    ${tickets.length === 0 ? `
      <div class="no-findings-banner">
        ✅ ${isEn ? "No defect tickets or optional notes were reported during this period. All inspection items passed normally." : "対象期間中に報告された不具合および申し送り事項はありません。（全項目 正常稼働）"}
      </div>
    ` : `
      <div class="findings-grid">
        ${tickets.map((t) => {
          const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleString(isEn ? "en-US" : "ja-JP", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }) : "—";

          return `
            <div class="finding-card ${t.isDefect ? "finding-card-defect" : "finding-card-optional"}">
              <div class="finding-card-header ${t.isDefect ? "finding-card-header-defect" : "finding-card-header-optional"}">
                <span>${t.isDefect ? "⚠️ " + (isEn ? "Defect Finding" : "不具合指摘") : "💬 " + (isEn ? "Optional Note" : "現場申し送り")} #${t.ticketNo}</span>
                <span style="font-size: 7.5pt; font-weight: 600;">${dateStr}</span>
              </div>
              <div class="finding-body">
                <div class="finding-info">
                  <div class="finding-item-title">${escapeHtml(t.fieldLabel)}</div>
                  <div class="finding-meta">
                    <strong>${escapeHtml(t.formName)}</strong> • ${isEn ? "Worker" : "作業者"}: <strong>${escapeHtml(t.workerName)}</strong> • ${isEn ? "Value" : "記録値"}: <span style="font-weight: 800; color: ${t.isDefect ? "#dc2626" : "#2563eb"};">${escapeHtml(t.answerValue)}</span>
                  </div>
                  
                  <div class="reason-box">
                    <strong style="color: #475569;">${isEn ? "Reported Reason" : "指摘・連絡理由"}:</strong><br>
                    ${escapeHtml(t.reason)}
                  </div>

                  ${t.isClosed ? `
                    <div class="fix-box">
                      <strong>✅ ${isEn ? "Resolved / Closed" : "処置完了"}</strong> 
                      ${t.closedAt ? `(${new Date(t.closedAt).toLocaleString(isEn ? "en-US" : "ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })})` : ""}<br>
                      ${t.closedBy ? `担当: <strong>${escapeHtml(t.closedBy)}</strong><br>` : ""}
                      ${t.fixReason ? `処置内容: ${escapeHtml(t.fixReason)}` : ""}
                    </div>
                  ` : `
                    <div class="pending-box">
                      ⏳ ${isEn ? "Pending resolution" : "未対応・処置対応中"}
                    </div>
                  `}
                </div>

                ${t.imageURLs && t.imageURLs.length > 0 ? `
                  <div class="finding-photos">
                    ${t.imageURLs.map((url, imgIdx) => `
                      <img src="${escapeHtml(url)}" class="finding-photo" alt="Photo ${imgIdx + 1}" />
                    `).join("")}
                  </div>
                ` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `}

    <!-- Section 3: Summary Breakdown by Form -->
    <div class="section-header">
      <span>📊 3. ${isEn ? "Inspection Items Pass Rate Summary" : "点検項目別 合格率サマリー"}</span>
      <span class="section-note">${isEn ? "Master list of inspection criteria and compliance statistics" : "点検基準および項目別の達成率一覧"}</span>
    </div>

    ${formSections.map((section) => `
      <div style="margin-bottom: 14px;">
        <div style="font-size: 9.5pt; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
          <span class="pill pill-neutral" style="font-size: 7.5pt; margin-right: 4px;">${escapeHtml(section.scheduleLabel)}</span>
          ${escapeHtml(section.formName)} <span style="font-size: 8pt; font-weight: normal; color: #64748b;">(${section.fields.length} 項目)</span>
        </div>
        <table class="flat-table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">No</th>
              <th style="width: 220px;">${isEn ? "Inspection Item (Step)" : "点検箇所／項目"}</th>
              <th>${isEn ? "Management Standard / Specification" : "管理規格・判断基準"}</th>
              <th style="width: 80px; text-align: center;">${isEn ? "Method" : "判定方式"}</th>
              <th style="width: 70px; text-align: center;">${isEn ? "Checks" : "点検回数"}</th>
              <th style="width: 75px; text-align: center;">${isEn ? "Pass Rate" : "合格率"}</th>
            </tr>
          </thead>
          <tbody>
            ${section.fields.map((f) => {
              let checkedCount = 0;
              let okCount = 0;
              dateColumns.forEach((c) => {
                const r = c.fieldResults[f.id];
                if (r) {
                  checkedCount += 1;
                  if (!r.isNG) okCount += 1;
                }
              });
              const rate = checkedCount > 0 ? Math.round((okCount / checkedCount) * 100) : 100;
              return `
                <tr>
                  <td style="font-weight: 800; text-align: center; color: #64748b;">${f.index}</td>
                  <td style="font-weight: 700;">${escapeHtml(f.label)}</td>
                  <td style="color: #334155;">${escapeHtml(f.standard)}</td>
                  <td style="text-align: center;">${escapeHtml(f.method)}</td>
                  <td style="text-align: center; font-weight: 600;">${checkedCount}</td>
                  <td style="text-align: center;">
                    <span class="pill ${rate === 100 ? "pill-ok" : "pill-defect"}">
                      ${rate}%
                    </span>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `).join("")}
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Downloads CSV format for machine checklist
 */
export function downloadMachineChecklistCSV(matrixData, periodLabel = "", format = "traditional") {
  const { machine, fields, formSections, dateColumns } = matrixData;

  if (format === "traditional") {
    // Matrix format grouped by form title
    const headers = [
      "符号",
      "点検フォーム / 区分",
      "点検箇所/項目",
      "管理規格",
      "記入方法",
      ...dateColumns.map((c) => `${c.dayNumber}日(${c.dayOfWeek})`),
    ];

    const rows = [];
    formSections.forEach((section) => {
      // Section header row
      rows.push([
        `"【${section.scheduleLabel}】${section.formName}"`,
        '""',
        '""',
        '""',
        '""',
        ...dateColumns.map(() => '""'),
      ].join(","));

      section.fields.forEach((f) => {
        const dayValues = dateColumns.map((col) => {
          const res = col.fieldResults[f.id];
          if (!res) return "—";
          if (res.isNG) return "✕";
          if (f.type === "toggle" || f.type === "check" || !res.value || res.value === "OK") return "◯";
          return String(res.value).replace(/"/g, '""');
        });

        rows.push([
          f.index,
          `"${f.scheduleLabel}"`,
          `"${f.label.replace(/"/g, '""')}"`,
          `"${f.standard.replace(/"/g, '""')}"`,
          `"${f.method}"`,
          ...dayValues.map((v) => `"${v}"`),
        ].join(","));
      });

      // Form Specific Operator row
      const formOperatorRow = [
        "",
        `"担当作業者"`,
        `"【${section.formName}】"`,
        "実施者氏名",
        "氏名",
        ...dateColumns.map((c) => {
          const formRes = c.formResults?.[section.formId];
          return `"${(formRes?.operators || "").replace(/"/g, '""')}"`;
        }),
      ].join(",");
      rows.push(formOperatorRow);
    });

    // Overall Supervisor row
    const supervisorRow = [
      "",
      "確認欄",
      "現場責任者確認",
      "全項目完了確認",
      "レ点",
      ...dateColumns.map((c) => c.hasAnySubmission ? (c.hasNG ? '"✕"' : '"◯"') : '""'),
    ].join(",");

    const csvContent = "\uFEFF" + [headers.join(","), ...rows, supervisorRow].join("\r\n");
    triggerDownload(csvContent, `設備点検表_${machine.name}_${periodLabel}.csv`);
  } else {
    // Detailed list format with Form Name column
    const headers = [
      "日付",
      "設備名",
      "工場",
      "点検フォーム名",
      "点検周期",
      "点検項目 (Step)",
      "管理規格",
      "記録値",
      "判定",
      "作業者",
    ];

    const rows = [];
    dateColumns.forEach((col) => {
      fields.forEach((f) => {
        const res = col.fieldResults[f.id];
        if (res) {
          const formRes = col.formResults?.[f.formId];
          const worker = formRes?.operators || col.operators || "—";
          rows.push([
            col.dateKey,
            `"${machine.name.replace(/"/g, '""')}"`,
            `"${machine.factory}"`,
            `"${f.formName.replace(/"/g, '""')}"`,
            `"${f.scheduleLabel}"`,
            `"${f.label.replace(/"/g, '""')}"`,
            `"${f.standard.replace(/"/g, '""')}"`,
            `"${String(res.value ?? "").replace(/"/g, '""')}"`,
            res.isNG ? "NG" : "OK",
            `"${worker.replace(/"/g, '""')}"`,
          ].join(","));
        }
      });
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    triggerDownload(csvContent, `点検実績データ_${machine.name}_${periodLabel}.csv`);
  }
}

function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
