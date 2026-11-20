import { useEffect, useRef } from "react";

// One stack for every open modal in the app: Escape closes only the modal on top, then the one
// under it on the next press, and so on.
//
// - Register a modal with useEscapeClose(onClose, isOpen). The newest open modal is on top.
// - A widget inside a modal that handles Escape itself (dropdown, editor, input) can call
//   e.preventDefault(); the modal then stays open for that press.
// - The modal on top stops the event, so no other Escape listener closes a second modal.
const stack = [];

function handleKeyDown(e) {
  if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  top.close();
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", handleKeyDown);
}

export function isEscapeModalOpen() {
  return stack.length > 0;
}

export default function useEscapeClose(onClose, active = true) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return undefined;
    const entry = { close: () => onCloseRef.current?.() };
    stack.push(entry);
    return () => {
      const at = stack.indexOf(entry);
      if (at >= 0) stack.splice(at, 1);
    };
  }, [active]);
}
