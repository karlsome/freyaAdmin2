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
      <div className="px-6 py-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-on-surface">Upload Progress</span>
          <span className="text-sm font-bold text-primary">{current} / {total}</span>
        </div>
        
        <div className="w-full bg-surface-container-highest rounded-full h-3 overflow-hidden">
          <div 
            className="bg-primary h-3 rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        
        <p className="mt-4 text-xs text-on-surface-variant text-center">
          {progressPercent === 100 ? "Finishing up..." : `Uploading: ${progressPercent}%`}
        </p>
      </div>
    </ModalShell>
  );
}
