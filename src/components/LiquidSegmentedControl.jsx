import { useLayoutEffect, useRef, useState } from "react";

function normalizeItems(items = []) {
  return items.map((item) => {
    if (typeof item === "string") {
      return { key: item, label: item, disabled: false };
    }

    return {
      key: item.key,
      label: item.label ?? item.key,
      disabled: Boolean(item.disabled),
    };
  });
}

export default function LiquidSegmentedControl({
  items,
  activeKey,
  onChange,
  className = "",
}) {
  const normalizedItems = normalizeItems(items);
  const containerRef = useRef(null);
  const buttonRefs = useRef(new Map());
  const moveTimeoutRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState(null);
  const [isMoving, setIsMoving] = useState(false);

  const itemSignature = normalizedItems.map((item) => `${item.key}:${item.label}`).join("|");

  useLayoutEffect(() => {
    function syncIndicator() {
      const container = containerRef.current;
      const activeButton = buttonRefs.current.get(activeKey);

      if (!container || !activeButton) {
        setIndicatorStyle(null);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeButton.getBoundingClientRect();

      setIndicatorStyle({
        left: activeRect.left - containerRect.left,
        top: activeRect.top - containerRect.top,
        width: activeRect.width,
        height: activeRect.height,
      });
    }

    const frame = window.requestAnimationFrame(() => {
      syncIndicator();
      setIsMoving(true);
      window.clearTimeout(moveTimeoutRef.current);
      moveTimeoutRef.current = window.setTimeout(() => setIsMoving(false), 460);
    });

    window.addEventListener("resize", syncIndicator);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncIndicator);
      window.clearTimeout(moveTimeoutRef.current);
    };
  }, [activeKey, itemSignature]);

  if (!normalizedItems.length) return null;

  return (
    <div ref={containerRef} className={`relative flex flex-wrap gap-1 rounded-xl bg-surface-container p-1 ${className}`.trim()}>
      {indicatorStyle && (
        <span
          aria-hidden="true"
          className="pagination-liquid-shell rounded-lg"
          style={{
            width: `${indicatorStyle.width}px`,
            height: `${indicatorStyle.height}px`,
            transform: `translate(${indicatorStyle.left}px, ${indicatorStyle.top}px)`,
          }}
        >
          <span className="pagination-liquid-glow" />
          <span className={`pagination-liquid-blob ${isMoving ? "is-moving" : ""}`} />
        </span>
      )}

      {normalizedItems.map((item) => {
        const active = item.key === activeKey;

        return (
          <button
            key={item.key}
            ref={(node) => {
              if (node) buttonRefs.current.set(item.key, node);
              else buttonRefs.current.delete(item.key);
            }}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) onChange(item.key);
            }}
            className={[
              "relative z-10 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors duration-300",
              active
                ? "border border-transparent bg-transparent text-on-primary"
                : "text-on-surface-variant hover:text-on-surface",
              item.disabled ? "cursor-not-allowed opacity-50" : "",
            ].join(" ")}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}