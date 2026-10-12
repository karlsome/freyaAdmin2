import { LAYOUT_MODES } from "./widgetRegistry";

/** Mini drawings of the 4 layouts (cells in a 2×2 unit grid). */
const ICON_CELLS = {
  1: [[0, 0, 2, 2]],
  2: [[0, 0, 2, 1], [0, 1, 2, 1]],
  3: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 2, 1]],
  4: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1]],
};

function LayoutIcon({ mode }) {
  const gap = 1.5;
  const unit = 10;
  return (
    <svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true">
      {ICON_CELLS[mode].map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x * (unit + gap) + 0.5}
          y={y * (unit + gap) + 0.5}
          width={w * unit + (w - 1) * gap}
          height={h * unit + (h - 1) * gap}
          rx="2.2"
        />
      ))}
    </svg>
  );
}

export default function LayoutSwitcher({ mode, onChange, isJa }) {
  return (
    <div className="dash-layout-switch" role="radiogroup" aria-label={isJa ? "レイアウト" : "Layout"}>
      {Object.keys(LAYOUT_MODES).map((m) => {
        const n = Number(m);
        const active = n === mode;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? "is-active" : ""}
            onClick={() => onChange(n)}
            title={isJa ? `レイアウト ${m}` : `Layout ${m}`}
          >
            <LayoutIcon mode={n} />
          </button>
        );
      })}
    </div>
  );
}
