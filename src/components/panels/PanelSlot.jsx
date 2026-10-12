import { WIDGETS, widgetLabel } from "./widgetRegistry";

/**
 * One grid slot: a slim header (icon, title, "change" button) and the widget body.
 */
export default function PanelSlot({ widgetId, area, highlighted, onChange, isJa, flush, children }) {
  const w = WIDGETS[widgetId];
  return (
    <section
      className={`dash-slot ${highlighted ? "is-highlighted" : ""}`}
      style={{ gridArea: area, "--tile": w?.color }}
      aria-label={widgetLabel(widgetId, isJa)}
    >
      <header className="dash-slot__header">
        <span className="dash-slot__icon material-symbols-outlined">{w?.icon}</span>
        <h2 className="dash-slot__title">{widgetLabel(widgetId, isJa)}</h2>
        <button type="button" className="dash-slot__change" onClick={onChange}>
          <span className="material-symbols-outlined">swap_horiz</span>
          <span className="dash-slot__change-label">{isJa ? "変更" : "Change"}</span>
        </button>
      </header>
      <div className={`dash-slot__body ${flush ? "dash-slot__body--flush" : ""}`}>{children}</div>
    </section>
  );
}
