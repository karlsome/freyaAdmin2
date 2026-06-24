import ModalShell from "./ModalShell";

export default function PceFilesConflictModal({ open, conflicts, onResolve, onCancel }) {
  if (!open || !conflicts?.length) return null;

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title="Files Already Exist"
      subtitle="The following files already exist in Google Drive."
      maxWidth="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-variant/50 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={() => onResolve("skip")} className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors">
            Skip Existing
          </button>
          <button onClick={() => onResolve("overwrite")} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">
            Overwrite All
          </button>
        </div>
      }
    >
      <div className="p-4 flex flex-col gap-3 max-h-64 overflow-y-auto">
        <ul className="list-disc pl-5 text-sm text-on-surface-variant flex flex-col gap-1">
          {conflicts.map((file, i) => (
            <li key={i}>{file}</li>
          ))}
        </ul>
      </div>
    </ModalShell>
  );
}
