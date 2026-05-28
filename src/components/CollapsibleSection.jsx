import { useState } from "react";

export default function CollapsibleSection({
  icon,
  label,
  badge,
  defaultOpen = false,
  children,
  wrapperClassName,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={wrapperClassName ?? "px-6 py-0 border-t border-white/10"}>
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 py-4 text-[10px] font-bold uppercase tracking-wider text-outline hover:text-on-surface transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-1.5">
          {icon ? <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span> : null}
          {label}
          {badge ?? null}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {open ? "keyboard_arrow_up" : "keyboard_arrow_down"}
        </span>
      </button>
      {open ? children : null}
    </div>
  );
}
