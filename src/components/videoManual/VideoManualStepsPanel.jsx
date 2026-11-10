import { useLanguage } from "../../contexts/LanguageContext";

function Icon({ children, className = "text-[16px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function formatStepTime(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "0.0s";
  return `${seconds.toFixed(1)}s`;
}

function findStepDescription(step, stepDescriptions = [], tolerance = 0.15) {
  const match = stepDescriptions.find((entry) => Math.abs(Number(entry.start) - step.startTime) < tolerance);
  return match?.description || "";
}

export default function VideoManualStepsPanel({ steps, stepDescriptions = [], onDescriptionChange, descriptionTolerance, onSelectStep, onAddStep }) {
  const { t } = useLanguage();
  return (
    <aside className="z-20 flex w-[180px] flex-shrink-0 flex-col border-r border-separator bg-surface xl:w-[220px]">
      <div className="flex items-center justify-between border-b border-separator px-3 py-3">
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-on-surface-variant">{t("Steps")}</span>
        <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">{steps.length}</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {steps.map((step, index) => (
          <div
            role="button"
            tabIndex={0}
            key={step.id}
            onClick={() => onSelectStep(step)}
            onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) onSelectStep(step); }}
            className="group cursor-pointer relative flex w-full flex-col gap-1 overflow-hidden rounded-lg border border-separator bg-primary/10 p-3 text-left shadow-sm transition hover:border-primary/30 hover:bg-primary/10"
          >
            <span className="absolute inset-y-0 left-0 w-1 bg-primary" />
            <span className="flex items-center gap-2 pl-1">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-black text-on-primary">{index + 1}</span>
              <span className="min-w-0 truncate text-sm font-black text-on-surface">{step.label}</span>
            </span>
            <span className="pl-8 text-xs font-semibold text-on-surface-variant">
              {formatStepTime(step.startTime)} - {formatStepTime(step.endTime)}
            </span>
            <textarea
              rows={2}
              value={findStepDescription(step, stepDescriptions, descriptionTolerance)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onChange={(event) => onDescriptionChange?.(step, event.target.value)}
              placeholder={t("Add description...")}
              className="ml-8 w-[calc(100%-2rem)] resize-none rounded border border-transparent bg-transparent p-1 text-xs font-medium text-on-surface-variant outline-none placeholder:text-outline hover:border-separator focus:border-primary/40 focus:bg-surface"
            />
          </div>
        ))}

        {steps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-separator px-3 py-6 text-center text-xs font-semibold text-outline">
            {t("No video clips on the timeline")}
          </div>
        ) : null}
      </div>

      <div className="border-t border-separator p-2">
        <button
          type="button"
          onClick={onAddStep}
          className="flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-surface-container text-sm font-bold text-on-surface-variant transition hover:bg-surface-container-high"
        >
          <Icon>add</Icon>
          {t("Add Step")}
        </button>
      </div>
    </aside>
  );
}