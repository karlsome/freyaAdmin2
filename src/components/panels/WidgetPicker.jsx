import { useEffect, useRef } from "react";
import { PICKER_GROUPS, WIDGETS, widgetLabel } from "./widgetRegistry";

/**
 * Big icon tiles to choose what a slot shows. Uses the native <dialog> for focus + Escape handling.
 */
export default function WidgetPicker({ open, currentId, usedIds, onPick, onClose, onReset, isJa }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dash-picker"
      onClose={onClose}
      onCancel={(e) => { e.stopPropagation(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-label={isJa ? "表示する内容を選ぶ" : "Choose what to show"}
    >
      {open && (
        <div className="dash-picker__body">
          <header className="dash-picker__header">
            <h2>{isJa ? "表示する内容を選ぶ" : "Choose what to show"}</h2>
            <button type="button" className="twin-icon-btn" onClick={onClose} aria-label={isJa ? "閉じる" : "Close"}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>

          {PICKER_GROUPS.map((group) => (
            <section key={group.en} className="dash-picker__group">
              <h3>{isJa ? group.ja : group.en}</h3>
              <div className="dash-picker__grid">
                {group.ids.map((id) => {
                  const w = WIDGETS[id];
                  const isCurrent = id === currentId;
                  const elsewhere = !isCurrent && usedIds.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`dash-picker__tile ${isCurrent ? "is-current" : ""}`}
                      style={{ "--tile": w.color }}
                      onClick={() => onPick(id)}
                    >
                      <span className="dash-picker__icon material-symbols-outlined">{w.icon}</span>
                      <span className="dash-picker__label">{widgetLabel(id, isJa)}</span>
                      {isCurrent && (
                        <span className="dash-picker__tag">{isJa ? "表示中" : "Showing"}</span>
                      )}
                      {elsewhere && (
                        <span className="dash-picker__tag dash-picker__tag--swap">
                          <span className="material-symbols-outlined">swap_horiz</span>
                          {isJa ? "入れ替え" : "Swap"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <footer className="dash-picker__footer">
            <button type="button" className="dash-link-btn" onClick={onReset}>
              <span className="material-symbols-outlined">restart_alt</span>
              {isJa ? "このレイアウトを初期状態に戻す" : "Reset this layout"}
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
