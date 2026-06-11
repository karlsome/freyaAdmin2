function PreviewTable({ rows }) {
  if (!rows.length) return null;

  const previewRows = rows.slice(0, 5);
  const columns = Object.keys(previewRows[0] || {});

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-separator/40 bg-surface-container-low">
      <div className="border-b border-outline-variant/30 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-outline">
        CSV Preview
      </div>
      <div className="overflow-x-auto">
        <table className="ui-table-data min-w-full">
          <thead className="bg-surface-container">
            <tr>
              {columns.map((column) => (
                <th key={column} className="ui-table-heading px-3 py-2 text-left text-on-surface-variant whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, index) => (
              <tr key={index} className="border-t border-outline-variant/20">
                {columns.map((column) => (
                  <td key={column} className="px-3 py-2 text-on-surface whitespace-nowrap">
                    {row[column] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-outline-variant/20 px-4 py-3 text-xs text-on-surface-variant">
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
    <div className="glass-card rounded-2xl p-5 mb-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>
                upload_file
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-on-surface">CSV Import</h3>
              <p className="text-sm text-on-surface-variant">
                Parse Shift-JIS files, preview the first rows, then insert everything into the current master collection.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-primary/35 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10">
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
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
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