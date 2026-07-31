import { useEffect, useRef, useState } from "react";

const VIEWPORT_MARGIN = 8;

export function useMovablePanel({
  active,
  storageKey,
  defaultTop = 88,
  defaultRight = 20,
  defaultWidth = 430,
}) {
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const [position, setPosition] = useState(() => readPosition(storageKey));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!active || !position) return undefined;
    let frameId;

    const keepInsideWindow = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect) return;
        setPosition((current) => {
          if (!current) return current;
          const next = clampPosition(current, rect);
          if (next.left === current.left && next.top === current.top) return current;
          writePosition(storageKey, next);
          return next;
        });
      });
    };

    keepInsideWindow();
    window.addEventListener("resize", keepInsideWindow);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", keepInsideWindow);
    };
  }, [active, storageKey]);

  function beginDrag(event) {
    if (!active || event.button !== 0 || event.target.closest("button")) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = clampPosition({
      left: drag.left + event.clientX - drag.startX,
      top: drag.top + event.clientY - drag.startY,
    }, drag);
    setPosition(next);
  }

  function endDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPosition((current) => {
      if (current) writePosition(storageKey, current);
      return current;
    });
  }

  return {
    rootRef,
    dragging,
    style: active
      ? position
        ? { left: `${position.left}px`, top: `${position.top}px` }
        : {
            left: `${Math.max(
              VIEWPORT_MARGIN,
              window.innerWidth - defaultRight - Math.min(defaultWidth, window.innerWidth - (VIEWPORT_MARGIN * 2)),
            )}px`,
            top: `${defaultTop}px`,
          }
      : undefined,
    handleProps: {
      onPointerDown: beginDrag,
      onPointerMove: moveDrag,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}

function clampPosition(position, size) {
  const width = size.width ?? 0;
  const height = size.height ?? 0;
  return {
    left: Math.min(
      Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
      Math.max(VIEWPORT_MARGIN, position.left),
    ),
    top: Math.min(
      Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
      Math.max(VIEWPORT_MARGIN, position.top),
    ),
  };
}

function readPosition(storageKey) {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    if (!Number.isFinite(value?.left) || !Number.isFinite(value?.top)) return null;
    return value;
  } catch {
    return null;
  }
}

function writePosition(storageKey, position) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(position));
  } catch {
    // The panel still moves for this session when browser storage is unavailable.
  }
}
