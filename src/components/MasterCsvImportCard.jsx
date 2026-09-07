function PreviewTable({ rows }) {
  if (!rows.length) return null;

  const previewRows = rows.slice(0, 5);
  const columns = Object.keys(previewRows[0] || {});

  return (
    <div className="mt-4 overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
        CSV Preview
      </div>
      <div className="overflow-x-auto">
        <table className="ui-table-data min-w-full">
          <thead className="bg-[var(--surface-subtle)] border-b border-[var(--border)]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, index) => (
              <tr key={index} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors">
                {columns.map((column) => (
                  <td key={column} className="px-3 py-2 text-xs font-mono text-[var(--text-primary)] whitespace-nowrap">
                    {row[column] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-mono text-[var(--text-muted)]">
        Showing {Math.min(5, rows.length)} of {rows.length} parsed rows.
      </div>
    </div>
  );
}

export default function MasterCsvImportCard({
  fileName,
  parsedRows,
  parsing,
  importing,
  onFileSelect,
  onImport,
}) {
  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5 mb-6 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
                upload_file
              </span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">CSV Import</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Parse Shift-JIS files, preview the first rows, then insert everything into the current master collection.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-[6px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--freya-blue)] transition-colors">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => onFileSelect(event.target.files?.[0] || null)}
            />
            {parsing ? "Parsing…" : fileName ? `Selected: ${fileName}` : "Choose CSV file"}
          </label>

          <button
            type="button"
            onClick={onImport}
            disabled={!parsedRows.length || importing}
            className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-40 shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              cloud_upload
            </span>
            {importing ? "Importing…" : "Insert All To Database"}
          </button>
        </div>
      </div>

      <PreviewTable rows={parsedRows} />
    </div>
  );
}