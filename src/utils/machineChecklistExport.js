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

  // 3. Map records by date string "YYYY-MM-DD"
  const recordsByDate = new Map();
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
  });

  // 4. Build column data for each date in dates array
  const dateColumns = dates.map((dateObj) => {
    const dateKey = formatDateKey(dateObj);
    const dayRecords = recordsByDate.get(dateKey) || [];
    const dayNumber = new Date(dateObj).getDate();
    const dayOfWeek = new Date(dateObj).toLocaleDateString("ja-JP", { weekday: "short" });

    // Aggregate answers for all fields on this day
    const fieldResults = {};
    const formResults = {}; // formId -> { operators: Set<string>, hasSubmission: boolean, hasNG: boolean }
    const allOperators = new Set();
    let hasAnySubmission = dayRecords.length > 0;
    let hasNG = false;

    // Initialize formResults for each form section
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

      // Extract answers from rec.answers array or rec.responses object
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

    // Format per-form results
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
    totalSubmissions: records.length,
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
      border: 2px solid #000;
      padding: 4px;
      background: #fff;
    }

    /* Header */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }
    .header-table td {
      padding: 2px 4px;
      vertical-align: middle;
    }
    .main-title {
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: 0.15em;
      text-decoration: underline;
      text-underline-offset: 4px;
    }
    .meta-box {
      font-size: 9.5pt;
      font-weight: bold;
    }
    .meta-value {
      font-size: 11pt;
      font-weight: 900;
      border-bottom: 1.5px solid #000;
      padding: 0 6px;
      display: inline-block;
      min-width: 50px;
      text-align: center;
    }

    /* Main Grid */
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      font-size: 7pt;
    }
    .grid-table th, .grid-table td {
      border: 1px solid #000;
      padding: 2px 1px;
      text-align: center;
      vertical-align: middle;
    }
    .grid-table th {
      background: #f8fafc;
      font-weight: bold;
    }
    .col-code { width: 24px; }
    .col-cat { width: 44px; }
    .col-label { width: 140px; text-align: left; padding: 2px 4px; }
    .col-standard { width: 120px; text-align: left; padding: 2px 4px; font-size: 6.5pt; }
    .col-method { width: 32px; }
    .day-col {
      min-width: 14px;
      max-width: 18px;
      padding: 0 !important;
      font-size: 6.5pt;
    }
    .day-header {
      font-size: 7pt;
      font-weight: bold;
    }
    .day-weekday {
      font-size: 5.5pt;
      color: #475569;
    }

    /* Checklist Form Section Header */
    .form-section-header-row td {
      background: #e2e8f0 !important;
      color: #0f172a !important;
      font-weight: 800 !important;
      font-size: 7.5pt !important;
      text-align: left !important;
      padding: 3px 6px !important;
      border-top: 1.5px solid #000 !important;
      border-bottom: 1.5px solid #000 !important;
      letter-spacing: 0.03em;
    }
    .form-section-badge {
      display: inline-block;
      background: #1e293b;
      color: #fff;
      padding: 1px 5px;
      border-radius: 2px;
      font-size: 6pt;
      margin-right: 6px;
      font-weight: bold;
    }

    .val-ok {
      font-size: 8.5pt;
      font-weight: bold;
      color: #000;
    }
    .val-ng {
      font-size: 8.5pt;
      font-weight: 900;
      color: #dc2626;
      background: #fee2e2;
    }
    .val-text {
      font-size: 6pt;
      font-weight: 600;
      word-break: break-all;
    }

    .supervisor-row td {
      font-weight: bold;
      height: 20px;
      background: #fafafa;
    }
    .supervisor-title {
      text-align: left !important;
      padding-left: 6px !important;
      font-size: 7pt;
    }

    /* Photo Guide */
    .photo-section {
      margin-top: 5px;
      border-top: 1.5px solid #000;
      padding-top: 3px;
    }
    .photo-title {
      font-size: 7.5pt;
      font-weight: bold;
      margin-bottom: 2px;
    }
    .photo-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .photo-card {
      border: 1px solid #94a3b8;
      border-radius: 3px;
      padding: 2px;
      text-align: center;
      width: 82px;
      background: #fff;
    }
    .photo-card img {
      width: 100%;
      height: 48px;
      object-fit: cover;
      border-radius: 2px;
    }
    .photo-tag {
      font-size: 6pt;
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
        <td style="width: 38%;">
          <span class="main-title">設備点検記録（日常）</span>
        </td>
        <td style="width: 18%; text-align: center;">
          <span class="meta-box">設備No. <span class="meta-value">${escapeHtml(machine.setsubiNo || "")}</span></span>
        </td>
        <td style="width: 28%;">
          <span class="meta-box">設備名: <span class="meta-value" style="min-width: 110px;">${escapeHtml(machine.name)}</span></span>
        </td>
        <td style="width: 16%; text-align: right;">
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
            <th class="day-col day-header">${col.dayNumber}日</th>
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
          <!-- Section Header for each checklist form -->
          <tr class="form-section-header-row">
            <td colspan="${5 + dateColumns.length}">
              <span class="form-section-badge">${escapeHtml(section.scheduleLabel)}</span>
              <strong>${escapeHtml(section.formName)}</strong>
            </td>
          </tr>

          <!-- Steps for this checklist form -->
          ${section.fields.map((f) => `
            <tr>
              <td class="col-code font-bold">${f.index}</td>
              <td class="col-cat font-bold">${escapeHtml(f.scheduleLabel)}</td>
              <td class="col-label">${escapeHtml(f.label)}</td>
              <td class="col-standard">${escapeHtml(f.standard)}</td>
              <td class="col-method">${escapeHtml(f.method)}</td>
              ${dateColumns.map((col) => {
                const res = col.fieldResults[f.id];
                if (!res) {
                  return `<td class="day-col">—</td>`;
                }
                if (res.isNG) {
                  return `<td class="day-col val-ng">✕</td>`;
                }
                if (f.type === "toggle" || f.type === "check" || !res.value || res.value === "OK" || res.value === "ok") {
                  return `<td class="day-col val-ok">◯</td>`;
                }
                return `<td class="day-col val-text">${escapeHtml(res.value)}</td>`;
              }).join("")}
            </tr>
          `).join("")}

          <!-- Form Specific Operator Row -->
          <tr class="supervisor-row" style="height: 22px; font-size: 6.5pt;">
            <td colspan="5" class="supervisor-title" style="background: #f8fafc; font-weight: bold;">
              担当作業者（${escapeHtml(section.formName)}）
            </td>
            ${dateColumns.map((col) => {
              const formRes = col.formResults?.[section.formId];
              if (!formRes || !formRes.operators) return `<td class="day-col" style="background: #fafafa;"></td>`;
              const ops = formRes.operators.split(",").map((s) => s.trim()).filter(Boolean);
              return `
                <td class="day-col" style="font-size: 6pt; line-height: 1.1; padding: 2px 0 !important; vertical-align: middle; word-break: break-all; background: #fafafa;" title="${escapeHtml(formRes.operators)}">
                  ${ops.map((o) => escapeHtml(o)).join("<br>")}
                </td>
              `;
            }).join("")}
          </tr>
        `).join("")}

        <!-- Overall Supervisor Verification Row -->
        <tr class="supervisor-row" style="height: 22px;">
          <td colspan="5" class="supervisor-title" style="font-weight: 800; background: #e2e8f0;">
            現場責任者確認欄（レ点／確認印）
          </td>
          ${dateColumns.map((col) => {
            if (!col.hasAnySubmission) {
              return `<td class="day-col"></td>`;
            }
            if (col.hasNG) {
              return `<td class="day-col val-ng" title="NGあり">✕</td>`;
            }
            return `<td class="day-col val-ok" style="color: #16a34a;">◯</td>`;
          }).join("")}
        </tr>
      </tbody>
    </table>

    ${photoFields.length > 0 ? `
      <div class="photo-section">
        <div class="photo-title">【点検箇所・ガイド写真】（項目番号対応: 1～${fields.length}）</div>
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
 * Modern Digital Checklist PDF (デジタル・現代風フォーマット)
 * Clean executive dashboard style PDF report.
 */
export function openDigitalChecklistPrintWindow(matrixData, periodLabel = "") {
  const { machine, fields, formSections, dateColumns, totalSubmissions } = matrixData;
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("ポップアップがブロックされました。ブラウザでポップアップを許可してください。");
    return;
  }

  // Calculate statistics
  let totalCheckedSlots = 0;
  let totalOKSlots = 0;
  let totalNGSlots = 0;

  dateColumns.forEach((col) => {
    Object.values(col.fieldResults).forEach((res) => {
      totalCheckedSlots += 1;
      if (res.isNG) totalNGSlots += 1;
      else totalOKSlots += 1;
    });
  });

  const completionRate = dateColumns.length > 0
    ? Math.round((dateColumns.filter((c) => c.hasAnySubmission).length / dateColumns.length) * 100)
    : 0;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>デジタル点検レポート_${escapeHtml(machine.name)}_${escapeHtml(periodLabel)}</title>
  <style>
    @page {
      size: A3 landscape;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
      margin: 0;
      padding: 16px;
      color: #0f172a;
      background: #f8fafc;
      font-size: 9.5pt;
    }
    .no-print {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #fff;
      padding: 12px 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .print-btn {
      background: #3b82f6;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover { background: #2563eb; }

    .report-card {
      background: #fff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      margin-bottom: 20px;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .title-area h1 {
      margin: 0;
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .title-area p {
      margin: 4px 0 0 0;
      color: #64748b;
      font-size: 10pt;
    }
    .machine-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 6px 14px;
      border-radius: 9999px;
      font-weight: 700;
      color: #1d4ed8;
      font-size: 11pt;
    }

    /* KPI Stats */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .kpi-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      text-align: left;
    }
    .kpi-label {
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    .kpi-value {
      font-size: 18pt;
      font-weight: 800;
      margin-top: 4px;
      color: #0f172a;
    }
    .kpi-sub {
      font-size: 8pt;
      color: #94a3b8;
      margin-top: 2px;
    }

    .section-title {
      font-size: 12pt;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 8px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .form-group-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .form-group-title {
      font-size: 10pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .form-badge {
      background: #2563eb;
      color: #fff;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 600;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .data-table th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 600;
      text-align: left;
      padding: 7px 10px;
      border-bottom: 1px solid #cbd5e1;
    }
    .data-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 7.5pt;
      font-weight: 700;
    }
    .status-ok { background: #dcfce7; color: #15803d; }
    .status-ng { background: #fee2e2; color: #b91c1c; }
    .status-none { background: #f1f5f9; color: #64748b; }

    @media print {
      .no-print { display: none !important; }
      body { padding: 0; background: #fff; }
      .report-card { border: none; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div>
      <strong>デジタル点検レポート (Digital Modern Report)</strong> - ${escapeHtml(machine.name)} [${escapeHtml(periodLabel)}]
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ 印刷 / PDF保存 (Print / Save as PDF)</button>
  </div>

  <div class="report-card">
    <div class="header-row">
      <div class="title-area">
        <h1>設備点検デジタル報告書</h1>
        <p>対象期間: <strong>${escapeHtml(periodLabel)}</strong> • 工場: <strong>${escapeHtml(machine.factory)}</strong></p>
      </div>
      <div class="machine-badge">
        <span>⚙️ ${escapeHtml(machine.name)}</span>
        ${machine.setsubiNo ? `<span style="opacity: 0.6;">| No.${escapeHtml(machine.setsubiNo)}</span>` : ""}
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-label">実施率 (Compliance)</div>
        <div class="kpi-value" style="color: #2563eb;">${completionRate}%</div>
        <div class="kpi-sub">${dateColumns.filter((c) => c.hasAnySubmission).length} / ${dateColumns.length} 日 実施</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">総点検回数</div>
        <div class="kpi-value">${totalSubmissions} 回</div>
        <div class="kpi-sub">${fields.length} 点検項目 (${formSections.length} フォーム)</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">合格項目 (OK)</div>
        <div class="kpi-value" style="color: #16a34a;">${totalOKSlots}</div>
        <div class="kpi-sub">正常判定</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">NG指摘 (Findings)</div>
        <div class="kpi-value" style="color: ${totalNGSlots > 0 ? '#dc2626' : '#64748b'};">${totalNGSlots}</div>
        <div class="kpi-sub">${totalNGSlots > 0 ? '要対応または対応済' : '異常指摘なし'}</div>
      </div>
    </div>

    <!-- Summary Checklist Breakdown Grouped by Form -->
    <h3 class="section-title">📋 点検フォーム別・項目実績サマリー</h3>
    ${formSections.map((section) => `
      <div class="form-group-card">
        <div class="form-group-title">
          <span class="form-badge">${escapeHtml(section.scheduleLabel)}</span>
          <span>${escapeHtml(section.formName)}</span>
          <span style="font-size: 8pt; font-weight: normal; color: #64748b;">(${section.fields.length} 項目)</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 36px;">No</th>
              <th>点検項目 (Step Title)</th>
              <th>管理基準</th>
              <th style="width: 70px;">判定方法</th>
              <th style="width: 80px; text-align: center;">合格率</th>
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
                  <td style="font-weight: 700; color: #64748b;">${f.index}</td>
                  <td style="font-weight: 600;">${escapeHtml(f.label)}</td>
                  <td style="color: #475569;">${escapeHtml(f.standard)}</td>
                  <td>${escapeHtml(f.method)}</td>
                  <td style="text-align: center;">
                    <span class="status-chip ${rate === 100 ? 'status-ok' : 'status-ng'}">
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
