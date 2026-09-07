import { useEffect, useState } from "react";
import ModalShell from "./ModalShell";

export default function PceFilesConflictModal({ open, conflicts, onResolve, onCancel }) {
  const [resolutions, setResolutions] = useState({});

  useEffect(() => {
    if (open && conflicts?.length) {
      const initial = {};
      conflicts.forEach(f => {
        initial[f] = "overwrite";
      });
      setResolutions(initial);
    }
  }, [open, conflicts]);

  if (!open || !conflicts?.length) return null;

  function handleSelectChange(file, value) {
    setResolutions(prev => ({ ...prev, [file]: value }));
  }

  function handleSubmit() {
    onResolve(resolutions);
  }

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title="Files Already Exist"
      subtitle="The following files already exist in Google Drive. Choose an action for each."
      maxWidth="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
          >
            Submit
          </button>
        </div>
      }
    >
      <div className="p-4 flex flex-col gap-3 max-h-[50vh] overflow-y-auto">
        <div className="flex flex-col gap-2">
          {conflicts.map((file, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)]">
              <span className="text-xs font-mono font-medium text-[var(--text-primary)] truncate max-w-[340px]">{file}</span>
              <select
                value={resolutions[file] || "overwrite"}
                onChange={(e) => handleSelectChange(file, e.target.value)}
                className="text-xs rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors cursor-pointer"
              >
                <option value="overwrite">Overwrite</option>
                <option value="skip">Skip</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
