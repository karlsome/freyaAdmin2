import React from 'react';
import ModalShell from "./ModalShell";

export default function UploadProgressModal({
  open,
  current,
  total,
}) {
  const progressPercent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <ModalShell
      open={open}
      onClose={() => {}} // Disable closing by clicking outside
      title="Uploading Files..."
      subtitle="Please wait while your files are being uploaded to the server."
      maxWidth="max-w-md"
      overlayOpacity="60"
      align="center"
    >
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[var(--text-primary)]">Upload Progress</span>
          <span className="text-xs font-bold text-[var(--freya-blue)]">{current} / {total}</span>
        </div>
        
        <div className="w-full bg-[var(--surface-subtle)] border border-[var(--border)] rounded-full h-2.5 overflow-hidden">
          <div 
            className="bg-[var(--freya-blue)] h-2.5 rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        
        <p className="mt-3 text-xs text-[var(--text-secondary)] text-center">
          {progressPercent === 100 ? "Finishing up..." : `Uploading: ${progressPercent}%`}
        </p>
      </div>
    </ModalShell>
  );
}
