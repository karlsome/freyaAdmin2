import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  bubbleAbsFromBox,
  bubbleBoxFromAbs,
  buildBubbleSvg,
  clipBoxFromDocument,
  documentFieldsFromBox,
  findBubblePair,
  parseBubbleGeometry,
} from "./bubbleUtils";
import { extractShapeStyle } from "./videoManualEditorUtils";

/**
 * Draggable handle on the pointer ("tail") of a speech bubble. Shown while the bubble's shape or text is selected.
 * Dragging it moves the tip anywhere on the canvas; the svg box grows/shrinks to fit.
 */
export default function BubbleTailHandle({ editRef, studioElRef, selectedClip }) {
  const [position, setPosition] = useState(null);
  const dragRef = useRef(null);
  const busyRef = useRef(false);

  const trackIndex = selectedClip?.trackIndex;
  const clipIndex = selectedClip?.clipIndex;
  const hasSelection = Number.isInteger(trackIndex) && Number.isInteger(clipIndex);

  const readState = () => {
    const edit = editRef.current;
    const root = studioElRef.current;
    if (!edit || !root || !hasSelection) return null;
    const container = edit.getViewportContainer?.();
    if (!container?.scale?.x) return null;
    const pair = findBubblePair(edit.getEdit(), trackIndex, clipIndex);
    if (!pair) return null;
    const editSize = { width: edit.size.width, height: edit.size.height };
    const geometry = parseBubbleGeometry(pair.shape.clip.asset?.src);
    const box = clipBoxFromDocument(pair.shape.clip, editSize);
    if (!geometry || !box || pair.shape.clip.transform?.rotate?.angle) return null;
    return { edit, root, container, pair, editSize, abs: bubbleAbsFromBox(box, geometry) };
  };

  useEffect(() => {
    if (!hasSelection) {
      setPosition(null);
      return undefined;
    }
    let frame = 0;
    const tick = () => {
      const state = readState();
      if (!state) {
        setPosition((current) => (current ? null : current));
      } else {
        const rect = state.root.getBoundingClientRect();
        const x = rect.left + state.container.position.x + state.abs.tip.x * state.container.scale.x;
        const y = rect.top + state.container.position.y + state.abs.tip.y * state.container.scale.y;
        setPosition((current) => (current && Math.abs(current.x - x) < 0.5 && Math.abs(current.y - y) < 0.5 ? current : { x, y }));
      }
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- readState only reads refs and the selection indices below
  }, [hasSelection, trackIndex, clipIndex]);

  const applyPointer = async (event) => {
    const state = readState();
    if (!state || busyRef.current) return;
    busyRef.current = true;
    try {
      const rect = state.root.getBoundingClientRect();
      const tip = {
        x: (event.clientX - rect.left - state.container.position.x) / state.container.scale.x,
        y: (event.clientY - rect.top - state.container.position.y) / state.container.scale.y,
      };
      const next = bubbleBoxFromAbs(state.abs.body, tip);
      const style = extractShapeStyle(state.pair.shape.clip.asset.src);
      await state.edit.updateClip(state.pair.shape.trackIndex, state.pair.shape.clipIndex, {
        asset: { ...state.pair.shape.clip.asset, src: buildBubbleSvg(next.box.width, next.box.height, next.geometry, style) },
        ...documentFieldsFromBox(next.box, state.editSize),
      });
    } catch (error) {
      console.error("Failed to move speech bubble pointer:", error);
    } finally {
      busyRef.current = false;
    }
  };

  if (!position) return null;

  return createPortal(
    <div
      role="slider"
      aria-label="Speech bubble pointer"
      title="Drag to move the pointer"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        dragRef.current = event.pointerId;
      }}
      onPointerMove={(event) => {
        if (dragRef.current !== event.pointerId) return;
        applyPointer(event);
      }}
      onPointerUp={(event) => {
        if (dragRef.current !== event.pointerId) return;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        applyPointer(event);
      }}
      style={{ position: "fixed", left: position.x - 9, top: position.y - 9, width: 18, height: 18, zIndex: 2000, touchAction: "none" }}
      className="cursor-grab rounded-full border-2 border-white bg-primary shadow-lg ring-2 ring-primary/40 active:cursor-grabbing"
    />,
    document.body,
  );
}
