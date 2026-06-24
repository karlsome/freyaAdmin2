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
        <div className="flex items-center justify-end gap-3 w-full">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-variant/50 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">
            Submit
          </button>
        </div>
      }
    >
      <div className="p-4 flex flex-col gap-3 max-h-[50vh] overflow-y-auto">
        <div className="flex flex-col gap-2">
          {conflicts.map((file, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-separator/30 rounded-lg bg-surface/50">
              <span className="text-sm font-medium text-on-surface">{file}</span>
              <select
                value={resolutions[file] || "overwrite"}
                onChange={(e) => handleSelectChange(file, e.target.value)}
                className="text-sm bg-surface border border-separator/50 rounded px-2 py-1 outline-none focus:border-primary transition-colors cursor-pointer"
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
