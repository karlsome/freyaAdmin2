import { useLayoutEffect, useRef, useState } from "react";

export default function MasterTabNav({ tabs, activeTab, onSelect }) {
  const containerRef = useRef(null);
  const tabButtonRefs = useRef(new Map());
  const moveTimeoutRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState(null);
  const [isMoving, setIsMoving] = useState(false);

  const tabSignature = tabs.map((tab) => `${tab.key}:${tab.label}`).join("|");

  useLayoutEffect(() => {
    function syncIndicator() {
      const container = containerRef.current;
      const activeButton = tabButtonRefs.current.get(activeTab);

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
  }, [activeTab, tabSignature]);

  return (
    <div className="glass-card rounded-2xl p-1.5 mb-6">
      <div ref={containerRef} className="relative flex flex-wrap gap-1">
        {indicatorStyle && (
          <span
            aria-hidden="true"
            className="pagination-liquid-shell rounded-xl"
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

        {tabs.map((tab) => {
          const active = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              ref={(node) => {
                if (node) tabButtonRefs.current.set(tab.key, node);
                else tabButtonRefs.current.delete(tab.key);
              }}
              type="button"
              onClick={() => onSelect(tab)}
              className={[
                "relative z-10 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold tracking-tight transition-colors duration-300",
                active
                  ? "border border-transparent bg-transparent text-on-primary"
                  : tab.ready
                    ? "text-on-surface hover:bg-surface-container"
                    : "text-on-surface-variant/60 hover:bg-surface-container",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}