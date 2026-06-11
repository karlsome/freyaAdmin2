import { useLayoutEffect, useRef, useState } from "react";

function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis-left", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages];
}

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function PaginationControls({
  page,
  totalPages,
  onPageChange,
  previousLabel = "Previous",
  nextLabel = "Next",
  disabled = false,
}) {
  const containerRef = useRef(null);
  const pageButtonRefs = useRef(new Map());
  const moveTimeoutRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState(null);
  const [isMoving, setIsMoving] = useState(false);

  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const paginationItems = buildPaginationItems(page, safeTotalPages);
  const paginationSignature = paginationItems.join("|");

  useLayoutEffect(() => {
    function syncIndicator() {
      const container = containerRef.current;
      const activeButton = pageButtonRefs.current.get(page);

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
      moveTimeoutRef.current = window.setTimeout(() => setIsMoving(false), 480);
    });

    window.addEventListener("resize", syncIndicator);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncIndicator);
      window.clearTimeout(moveTimeoutRef.current);
    };
  }, [page, paginationSignature]);

  if (!onPageChange || safeTotalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
        className="rounded-2xl border border-outline-variant/30 px-3 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
      >
        {previousLabel}
      </button>

      <div ref={containerRef} className="relative flex min-h-10 flex-wrap items-center gap-2">
        {indicatorStyle && (
          <span
            aria-hidden="true"
            className="pagination-liquid-shell rounded-2xl"
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

        {paginationItems.map((item) => {
          if (typeof item !== "number") {
            return <span key={item} className="relative z-10 px-2 text-outline">…</span>;
          }

          const active = item === page;
          return (
            <button
              key={item}
              ref={(node) => {
                if (node) pageButtonRefs.current.set(item, node);
                else pageButtonRefs.current.delete(item);
              }}
              type="button"
              disabled={disabled}
              onClick={() => onPageChange(item)}
              className={joinClasses(
                "relative z-10 min-w-10 rounded-2xl px-3 py-2 text-sm font-semibold transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40",
                active
                  ? "border border-transparent bg-transparent text-on-primary"
                  : "border border-outline-variant/30 text-on-surface hover:bg-surface-container"
              )}
            >
              {item}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= safeTotalPages}
        className="rounded-2xl border border-outline-variant/30 px-3 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
      >
        {nextLabel}
      </button>
    </div>
  );
}