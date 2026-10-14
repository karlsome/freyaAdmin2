import { useEffect, useRef, useState } from "react";

/**
 * Factory name in the dashboard header doubles as a picker.
 * 3D = hand-made floor map; Tablet = status from tablet sessions (no cycle sensors yet).
 */
export default function FactoryPicker({ factory, factories, onChange, isJa }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const list = factories.some((f) => f.factory === factory)
    ? factories
    : [{ factory, hasCycleSensors: false }, ...factories];

  return (
    <div className="factory-picker" ref={ref}>
      <button
        type="button"
        id="dashboard-factory-picker"
        className="factory-picker__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <h1 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] leading-tight">
          {isJa ? `${factory}工場` : `${factory} Factory`}
        </h1>
        <span className="material-symbols-outlined">expand_more</span>
      </button>

      {open && (
        <div className="factory-picker__menu" role="listbox" aria-label={isJa ? "工場を選択" : "Choose factory"}>
          {list.map((f) => (
            <button
              key={f.factory}
              type="button"
              role="option"
              aria-selected={f.factory === factory}
              className={`factory-picker__item ${f.factory === factory ? "is-current" : ""}`}
              onClick={() => { onChange(f.factory); setOpen(false); }}
            >
              <span className="material-symbols-outlined">{f.has3D ? "view_in_ar" : "grid_view"}</span>
              {f.factory}
              {f.has3D ? (
                <span className="factory-picker__tag factory-picker__tag--3d">3D</span>
              ) : (
                <span className="factory-picker__tag">
                  {f.hasCycleSensors ? (isJa ? "センサー" : "Sensors") : (isJa ? "タブレット" : "Tablet")}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
