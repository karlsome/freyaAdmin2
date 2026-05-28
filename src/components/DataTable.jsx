import { useEffect, useRef, useState } from "react";
import PaginationControls from "./PaginationControls";

function formatTableValue(value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function moveItem(items, fromIndex, toIndex) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function parseNumericSize(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function toSizeValue(value) {
  if (value == null) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

function hasBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getDefaultColumnOrder(columns) {
  return columns.map((column) => column.key);
}

function getDefaultColumnWidths(columns) {
  const widths = {};

  columns.forEach((column) => {
    const width = parseNumericSize(column.width);
    if (width != null) {
      widths[column.key] = width;
    }
  });

  return widths;
}

function normalizeColumnOrder(order, columns) {
  const nextKeys = getDefaultColumnOrder(columns);
  const safeOrder = Array.isArray(order) ? order.filter((key) => nextKeys.includes(key)) : [];

  return [...safeOrder, ...nextKeys.filter((key) => !safeOrder.includes(key))];
}

function normalizeColumnWidths(widths, columns) {
  if (!widths || typeof widths !== "object") return {};

  const allowedKeys = new Set(columns.map((column) => column.key));
  const normalizedWidths = {};

  Object.entries(widths).forEach(([key, value]) => {
    if (!allowedKeys.has(key)) return;

    const parsedValue = parseNumericSize(value);
    if (parsedValue != null) {
      normalizedWidths[key] = parsedValue;
    }
  });

  return normalizedWidths;
}

function areArraysEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function areWidthMapsEqual(left, right) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (!areArraysEqual(leftKeys, rightKeys)) return false;

  return leftKeys.every((key) => left[key] === right[key]);
}

function getWidthDiffMap(currentWidths, defaultWidths) {
  const diffMap = {};

  Object.entries(currentWidths).forEach(([key, value]) => {
    if (defaultWidths[key] !== value) {
      diffMap[key] = value;
    }
  });

  return diffMap;
}

function serializeArray(values) {
  return JSON.stringify(values);
}

function serializeWidthMap(widths) {
  return JSON.stringify(Object.entries(widths).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)));
}

function loadStoredColumnLayout(layoutStorageKey, columns) {
  const defaultOrder = getDefaultColumnOrder(columns);
  const defaultWidths = getDefaultColumnWidths(columns);

  if (!layoutStorageKey || !hasBrowserStorage()) {
    return {
      order: defaultOrder,
      widths: defaultWidths,
    };
  }

  try {
    const rawLayout = window.localStorage.getItem(layoutStorageKey);

    if (!rawLayout) {
      return {
        order: defaultOrder,
        widths: defaultWidths,
      };
    }

    const parsedLayout = JSON.parse(rawLayout);
    const storedOrder = normalizeColumnOrder(parsedLayout?.order, columns);
    const storedWidths = normalizeColumnWidths(parsedLayout?.widths, columns);

    return {
      order: storedOrder,
      widths: {
        ...defaultWidths,
        ...storedWidths,
      },
    };
  } catch {
    return {
      order: defaultOrder,
      widths: defaultWidths,
    };
  }
}

function defaultRenderPageInfo({ filteredCount, page, pageSize }) {
  if (!filteredCount) {
    return <span>0 records shown</span>;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, filteredCount);
  return <span>{filteredCount} records, showing {start}-{end}</span>;
}

function resolveValue(input, ...args) {
  return typeof input === "function" ? input(...args) : input;
}

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function alignClass(align = "left") {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

function StateMessage({ icon, title, message, toneClassName }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className={joinClasses("mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl", toneClassName)}>
        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{icon}</span>
      </div>
      <h3 className="text-lg font-black text-on-surface">{title}</h3>
      {message ? <p className="mt-2 text-sm text-on-surface-variant">{message}</p> : null}
    </div>
  );
}

export default function DataTable({
  columns = [],
  rows = [],
  loading = false,
  error = "",
  sort,
  page = 1,
  pageSize = 25,
  filteredCount = rows.length,
  totalPages = 0,
  onSort,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [],
  pageSizeLabel = "Rows",
  previousLabel = "Previous",
  nextLabel = "Next",
  rowKey,
  onRowClick,
  getRowClassName,
  renderPageInfo = defaultRenderPageInfo,
  loadingMessage = "Loading records…",
  errorTitle = "Could not load records",
  emptyTitle = "No matching records",
  emptyMessage = "Adjust the filters and try again.",
  enableColumnResize = false,
  enableColumnReorder = false,
  layoutStorageKey = null,
  resetColumnsLabel = "Reset columns",
  stickyHeader = false,
  stickyHeaderOffset = 0,
  stickyHeaderCellClassName = "bg-surface-container-low/95 backdrop-blur-md",
  defaultColumnWidth = null,
  defaultMinColumnWidth = 112,
  defaultMaxColumnWidth = null,
  className = "glass-card rounded-2xl overflow-hidden mb-8",
  topBarClassName = "flex flex-col gap-4 border-b border-separator/35 px-5 py-4 md:flex-row md:items-center md:justify-between",
  bottomBarClassName = "flex flex-col gap-4 border-t border-separator/30 px-5 py-4 md:flex-row md:items-center md:justify-between",
  topInfoClassName = "text-sm font-medium text-on-surface-variant",
  bottomInfoClassName = "text-sm text-on-surface-variant",
  tableClassName = "ui-table-data min-w-full",
  tableViewportClassName = "overflow-x-auto",
  tableViewportStyle,
  headClassName = "bg-surface-container-low border-b border-outline-variant/20",
  headerCellClassName = "px-3 py-3 text-left whitespace-nowrap",
  headerButtonClassName = "ui-table-heading inline-flex items-center gap-2 text-on-surface-variant transition hover:text-on-surface",
  rowClassName = "border-b border-outline-variant/10 transition hover:bg-primary/5",
  clickableRowClassName = "cursor-pointer",
  cellClassName = "px-3 py-3 align-top",
  rowsSelectClassName = "h-10 rounded-2xl border border-outline-variant/30 bg-white px-3 text-sm text-on-surface outline-none transition focus:border-primary/40",
  loadingOverlayClassName = "absolute inset-0 z-10 flex items-center justify-center bg-surface/70 backdrop-blur-sm",
  loadingPillClassName = "flex items-center gap-3 rounded-full bg-surface-container px-4 py-3 text-sm font-bold text-on-surface shadow-lg",
}) {
  const initialLayoutRef = useRef(null);

  if (initialLayoutRef.current == null) {
    initialLayoutRef.current = loadStoredColumnLayout(layoutStorageKey, columns);
  }

  const [columnOrder, setColumnOrder] = useState(() => initialLayoutRef.current.order);
  const [columnWidths, setColumnWidths] = useState(() => initialLayoutRef.current.widths);
  const [draggingColumnKey, setDraggingColumnKey] = useState(null);
  const [dragOverColumnKey, setDragOverColumnKey] = useState(null);
  const [resizingColumnKey, setResizingColumnKey] = useState(null);
  const resizeCleanupRef = useRef(null);
  const defaultColumnOrder = getDefaultColumnOrder(columns);
  const defaultColumnWidths = getDefaultColumnWidths(columns);
  const defaultColumnOrderSignature = serializeArray(defaultColumnOrder);
  const defaultColumnWidthsSignature = serializeWidthMap(defaultColumnWidths);
  const sortColumn = sort?.column ?? sort?.col ?? null;
  const sortDirection = sort?.direction ?? sort?.dir ?? 1;
  const pageInfo = renderPageInfo
    ? renderPageInfo({ filteredCount, page, pageSize, totalPages, rowsCount: rows.length })
    : null;
  const showPageSizeSelector = Boolean(onPageSizeChange && pageSizeOptions.length);
  const showBottomBar = Boolean(pageInfo) || Boolean(onPageChange && filteredCount > 0);

  useEffect(() => {
    const nextLayout = loadStoredColumnLayout(layoutStorageKey, columns);

    setColumnOrder((currentOrder) => (areArraysEqual(currentOrder, nextLayout.order) ? currentOrder : nextLayout.order));
    setColumnWidths((currentWidths) => (areWidthMapsEqual(currentWidths, nextLayout.widths) ? currentWidths : nextLayout.widths));
  }, [layoutStorageKey, defaultColumnOrderSignature, defaultColumnWidthsSignature]);

  useEffect(() => {
    setColumnOrder((currentOrder) => {
      const nextKeys = columns.map((column) => column.key);
      const preservedKeys = currentOrder.filter((key) => nextKeys.includes(key));
      const appendedKeys = nextKeys.filter((key) => !preservedKeys.includes(key));
      const mergedKeys = [...preservedKeys, ...appendedKeys];

      if (
        mergedKeys.length === currentOrder.length &&
        mergedKeys.every((key, index) => key === currentOrder[index])
      ) {
        return currentOrder;
      }

      return mergedKeys;
    });

    setColumnWidths((currentWidths) => {
      let changed = false;
      const nextWidths = {};

      columns.forEach((column) => {
        if (currentWidths[column.key] != null) {
          nextWidths[column.key] = currentWidths[column.key];
          return;
        }

        const width = parseNumericSize(column.width);
        if (width != null) {
          nextWidths[column.key] = width;
          changed = true;
        }
      });

      const sameKeys =
        Object.keys(currentWidths).length === Object.keys(nextWidths).length &&
        Object.entries(currentWidths).every(([key, value]) => nextWidths[key] === value);

      return changed || !sameKeys ? nextWidths : currentWidths;
    });
  }, [columns]);

  useEffect(() => () => {
    if (resizeCleanupRef.current) {
      resizeCleanupRef.current();
    }
  }, []);

  const columnMap = new Map(columns.map((column) => [column.key, column]));
  const displayOrder = [
    ...columnOrder.filter((key) => columnMap.has(key)),
    ...columns.map((column) => column.key).filter((key) => !columnOrder.includes(key)),
  ];
  const displayOrderSignature = serializeArray(displayOrder);
  const columnWidthsSignature = serializeWidthMap(columnWidths);
  const layoutDirty =
    !areArraysEqual(displayOrder, defaultColumnOrder) ||
    !areWidthMapsEqual(columnWidths, defaultColumnWidths);
  const showResetColumns = layoutDirty && (enableColumnResize || enableColumnReorder);
  const showTopBar = Boolean(pageInfo) || showPageSizeSelector || showResetColumns;

  const orderedColumns = displayOrder.map((key) => columnMap.get(key)).filter(Boolean);
  const resolvedColumns = orderedColumns.map((column) => {
    const minWidth = parseNumericSize(column.minWidth) ?? defaultMinColumnWidth;
    const maxWidth = parseNumericSize(column.maxWidth) ?? defaultMaxColumnWidth;
    const explicitWidth = columnWidths[column.key] ?? parseNumericSize(column.width) ?? defaultColumnWidth;
    const width = typeof explicitWidth === "number"
      ? Math.max(minWidth, maxWidth != null ? Math.min(explicitWidth, maxWidth) : explicitWidth)
      : explicitWidth;

    return {
      ...column,
      resolvedMinWidth: minWidth,
      resolvedMaxWidth: maxWidth,
      resolvedWidth: width,
    };
  });

  const hasManagedWidths = resolvedColumns.length > 0 && resolvedColumns.every((column) => typeof column.resolvedWidth === "number");
  const totalManagedWidth = hasManagedWidths
    ? resolvedColumns.reduce((sum, column) => sum + column.resolvedWidth, 0)
    : null;
  const tableStyle = totalManagedWidth
    ? { width: `max(100%, ${totalManagedWidth}px)`, tableLayout: "fixed" }
    : undefined;

  useEffect(() => {
    if (!layoutStorageKey || !hasBrowserStorage()) return;

    const persistedOrder = areArraysEqual(displayOrder, defaultColumnOrder) ? null : displayOrder;
    const persistedWidths = getWidthDiffMap(columnWidths, defaultColumnWidths);

    if (!persistedOrder && !Object.keys(persistedWidths).length) {
      window.localStorage.removeItem(layoutStorageKey);
      return;
    }

    window.localStorage.setItem(
      layoutStorageKey,
      JSON.stringify({
        order: persistedOrder,
        widths: persistedWidths,
      })
    );
  }, [layoutStorageKey, displayOrderSignature, columnWidthsSignature, defaultColumnOrderSignature, defaultColumnWidthsSignature]);

  function handleResetColumns() {
    if (resizeCleanupRef.current) {
      resizeCleanupRef.current();
    }

    setDraggingColumnKey(null);
    setDragOverColumnKey(null);
    setResizingColumnKey(null);
    setColumnOrder(defaultColumnOrder);
    setColumnWidths(defaultColumnWidths);
  }

  function handleColumnDragStart(event, columnKey) {
    if (!enableColumnReorder) return;

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", columnKey);
    setDraggingColumnKey(columnKey);
    setDragOverColumnKey(columnKey);
  }

  function handleColumnDragOver(event, columnKey) {
    if (!enableColumnReorder || !draggingColumnKey || draggingColumnKey === columnKey) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverColumnKey !== columnKey) {
      setDragOverColumnKey(columnKey);
    }
  }

  function handleColumnDrop(event, targetColumnKey) {
    if (!enableColumnReorder) return;

    event.preventDefault();
    const sourceColumnKey = draggingColumnKey || event.dataTransfer.getData("text/plain");
    setDraggingColumnKey(null);
    setDragOverColumnKey(null);

    if (!sourceColumnKey || sourceColumnKey === targetColumnKey) return;

    setColumnOrder((currentOrder) => {
      const sourceIndex = currentOrder.indexOf(sourceColumnKey);
      const targetIndex = currentOrder.indexOf(targetColumnKey);

      if (sourceIndex === -1 || targetIndex === -1) {
        return currentOrder;
      }

      return moveItem(currentOrder, sourceIndex, targetIndex);
    });
  }

  function handleColumnDragEnd() {
    setDraggingColumnKey(null);
    setDragOverColumnKey(null);
  }

  function handleResizeStart(event, column) {
    if (!enableColumnResize || column.resizable === false) return;

    event.preventDefault();
    event.stopPropagation();

    const headerCell = event.currentTarget.closest("th");
    const startWidth = headerCell?.getBoundingClientRect().width ?? column.resolvedWidth ?? defaultColumnWidth ?? 160;
    const minWidth = column.resolvedMinWidth ?? defaultMinColumnWidth;
    const maxWidth = column.resolvedMaxWidth ?? defaultMaxColumnWidth;
    const startX = event.clientX;

    if (resizeCleanupRef.current) {
      resizeCleanupRef.current();
    }

    setResizingColumnKey(column.key);

    function handleMouseMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX;
      const rawWidth = startWidth + deltaX;
      const nextWidth = Math.max(minWidth, maxWidth != null ? Math.min(rawWidth, maxWidth) : rawWidth);

      setColumnWidths((currentWidths) => {
        if (currentWidths[column.key] === nextWidth) {
          return currentWidths;
        }

        return {
          ...currentWidths,
          [column.key]: nextWidth,
        };
      });
    }

    function handleMouseUp() {
      setResizingColumnKey(null);
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
      }
    }

    resizeCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      resizeCleanupRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <div className={className}>
      {showTopBar && (
        <div className={topBarClassName}>
          {pageInfo ? <div className={topInfoClassName}>{pageInfo}</div> : <div />}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {showResetColumns && (
              <button
                type="button"
                onClick={handleResetColumns}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-outline-variant/30 px-4 text-sm font-bold text-on-surface transition hover:bg-surface-container"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>restart_alt</span>
                {resetColumnsLabel}
              </button>
            )}

            {showPageSizeSelector && (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">{pageSizeLabel}</span>
                <select
                  value={pageSize}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                  className={rowsSelectClassName}
                >
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        {loading && (
          <div className={loadingOverlayClassName}>
            <div className={loadingPillClassName}>
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>
                progress_activity
              </span>
              {loadingMessage}
            </div>
          </div>
        )}

        {error ? (
          <StateMessage
            icon="error"
            title={errorTitle}
            message={error}
            toneClassName="bg-error/10 text-error"
          />
        ) : !rows.length ? (
          <StateMessage
            icon="table_rows"
            title={emptyTitle}
            message={emptyMessage}
            toneClassName="bg-surface-container text-outline"
          />
        ) : (
          <div className={tableViewportClassName} style={tableViewportStyle}>
            <table className={tableClassName} style={tableStyle}>
              <colgroup>
                {resolvedColumns.map((column) => (
                  <col
                    key={column.key}
                    style={{
                      width: toSizeValue(column.resolvedWidth),
                      minWidth: toSizeValue(column.resolvedMinWidth),
                      maxWidth: toSizeValue(column.resolvedMaxWidth),
                    }}
                  />
                ))}
              </colgroup>

              <thead className={headClassName}>
                <tr>
                  {resolvedColumns.map((column) => {
                    const sortKey = column.sortKey ?? column.key;
                    const sortable = Boolean(onSort && sortKey && column.sortable !== false);
                    const reorderable = enableColumnReorder && column.reorderable !== false;
                    const resizable = enableColumnResize && column.resizable !== false;
                    const active = sortable && sortColumn === sortKey;
                    const arrow = !active ? "" : sortDirection === 1 ? "↑" : "↓";
                    const resolvedHeaderCellClassName = joinClasses(
                      headerCellClassName,
                      "relative",
                      stickyHeader ? "sticky" : "",
                      alignClass(column.align),
                      resizable ? "pr-5" : "",
                      stickyHeader ? stickyHeaderCellClassName : "",
                      dragOverColumnKey === column.key && draggingColumnKey !== column.key ? "bg-primary/5" : "",
                      draggingColumnKey === column.key ? "opacity-75" : "",
                      resolveValue(column.headerCellClassName, column)
                    );
                    const resolvedHeaderButtonClassName = joinClasses(
                      headerButtonClassName,
                      "min-w-0 flex-1",
                      column.align === "right" ? "w-full justify-end" : "",
                      column.align === "center" ? "w-full justify-center" : "",
                      resolveValue(column.headerButtonClassName, column)
                    );

                    return (
                      <th
                        key={column.key}
                        className={resolvedHeaderCellClassName}
                        style={stickyHeader ? { top: toSizeValue(stickyHeaderOffset), zIndex: 15 } : undefined}
                        onDragOver={reorderable ? (event) => handleColumnDragOver(event, column.key) : undefined}
                        onDrop={reorderable ? (event) => handleColumnDrop(event, column.key) : undefined}
                      >
                        <div className="flex items-center gap-2">
                          {sortable ? (
                            <button
                              type="button"
                              onClick={() => onSort(sortKey)}
                              className={resolvedHeaderButtonClassName}
                            >
                              <span className="truncate">{column.label}</span>
                              <span className={active ? "text-primary" : "text-outline"}>{arrow || "↕"}</span>
                            </button>
                          ) : (
                            <div className={resolvedHeaderButtonClassName}>
                              <span className="truncate">{column.label}</span>
                            </div>
                          )}

                          {reorderable && (
                            <button
                              type="button"
                              draggable
                              onClick={(event) => event.preventDefault()}
                              onDragStart={(event) => handleColumnDragStart(event, column.key)}
                              onDragEnd={handleColumnDragEnd}
                              className={joinClasses(
                                "relative z-10 flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-full text-outline transition hover:bg-surface-container hover:text-on-surface active:cursor-grabbing",
                                draggingColumnKey === column.key ? "text-primary" : ""
                              )}
                              aria-label={`Reorder ${column.label} column`}
                              title={`Drag to move ${column.label}`}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                                drag_indicator
                              </span>
                            </button>
                          )}
                        </div>

                        {resizable && (
                          <span
                            role="presentation"
                            onMouseDown={(event) => handleResizeStart(event, column)}
                            className={joinClasses(
                              "absolute inset-y-0 right-0 z-20 w-3 cursor-col-resize select-none touch-none",
                              resizingColumnKey === column.key ? "bg-primary/10" : ""
                            )}
                          >
                            <span className="absolute right-0 top-1/2 h-6 w-px -translate-y-1/2 bg-outline-variant/60" />
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIndex) => {
                  const resolvedRowKey = typeof rowKey === "function"
                    ? rowKey(row, rowIndex)
                    : rowKey
                      ? row?.[rowKey] ?? rowIndex
                      : rowIndex;

                  return (
                    <tr
                      key={resolvedRowKey}
                      onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                      className={joinClasses(
                        rowClassName,
                        onRowClick ? clickableRowClassName : "",
                        resolveValue(getRowClassName, row, rowIndex)
                      )}
                    >
                      {resolvedColumns.map((column) => {
                        const resolvedCellClassName = joinClasses(
                          cellClassName,
                          alignClass(column.align),
                          resolveValue(column.cellClassName, row, rowIndex, column)
                        );
                        const formattedValue = formatTableValue(row?.[column.key]);
                        const content = column.renderCell
                          ? column.renderCell(row, rowIndex, column)
                          : formattedValue;
                        const title = resolveValue(column.getCellTitle, row, rowIndex, column) ?? formattedValue;
                        const contentClassName = joinClasses(
                          column.wrap === true
                            ? "whitespace-normal break-words"
                            : "block min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap",
                          resolveValue(column.contentClassName, row, rowIndex, column)
                        );

                        return (
                          <td key={column.key} className={resolvedCellClassName}>
                            {column.disableCellWrapper ? (
                              content
                            ) : (
                              <div
                                className={contentClassName}
                                title={title || undefined}
                              >
                                {content}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showBottomBar && (
        <div className={bottomBarClassName}>
          {pageInfo ? <div className={bottomInfoClassName}>{pageInfo}</div> : <div />}

          {onPageChange && filteredCount > 0 && (
            <PaginationControls
              page={page}
              totalPages={totalPages || 1}
              onPageChange={onPageChange}
              previousLabel={previousLabel}
              nextLabel={nextLabel}
            />
          )}
        </div>
      )}
    </div>
  );
}