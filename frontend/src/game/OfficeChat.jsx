import { useEffect, useRef, useState } from "react";
import {
  clampOfficePosition,
  readOfficePosition,
  writeOfficePosition,
} from "./officeMessages.js";

export function OfficeChat({ messages, open, onOpen, onClose }) {
  const latestMessage = messages.at(-1);
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [position, setPosition] = useState(readOfficePosition);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open || !latestMessage || dragging) return undefined;
    const timeoutId = window.setTimeout(onClose, 9000);
    return () => window.clearTimeout(timeoutId);
  }, [dragging, latestMessage?.id, open]);

  useEffect(() => {
    if (!position) return undefined;
    let frameId;
    const keepInsideWindow = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect) return;
        setPosition((current) => {
          if (!current) return current;
          const next = clampOfficePosition(
            current,
            { width: rect.width, height: rect.height },
            { width: window.innerWidth, height: window.innerHeight },
          );
          if (next.right === current.right && next.top === current.top) return current;
          writeOfficePosition(next);
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
  }, [open]);

  if (!latestMessage) return null;

  const positionStyle = position
    ? { right: `${position.right}px`, top: `${position.top}px` }
    : undefined;

  function beginDrag(event) {
    if (event.button !== 0) return;
    if (event.currentTarget.tagName !== "BUTTON" && event.target.closest("button")) return;
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
      moved: false,
    };
    suppressClickRef.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.hypot(deltaX, deltaY) > 4) drag.moved = true;
    if (!drag.moved) return;
    const left = Math.min(
      window.innerWidth - drag.width - 8,
      Math.max(8, drag.left + deltaX),
    );
    const top = Math.min(
      window.innerHeight - drag.height - 8,
      Math.max(8, drag.top + deltaY),
    );
    setPosition({
      right: window.innerWidth - left - drag.width,
      top,
    });
  }

  function endDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPosition((current) => {
      if (current) writeOfficePosition(current);
      return current;
    });
  }

  if (!open) {
    return (
      <button
        ref={rootRef}
        type="button"
        className={`office-chat-tab ${dragging ? "dragging" : ""}`}
        style={positionStyle}
        title="Drag to move Inbox"
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          onOpen();
        }}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span>INBOX</span>
        <strong>{messages.length}</strong>
      </button>
    );
  }

  return (
    <aside
      ref={rootRef}
      className={`office-chat ${dragging ? "dragging" : ""}`}
      style={positionStyle}
      aria-live="polite"
    >
      <header
        title="Drag to move Inbox"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="office-chat-avatar" aria-hidden="true">
          {getInitials(latestMessage.sender)}
        </div>
        <div>
          <span>INCOMING OFFICE CHAT</span>
          <strong>{latestMessage.sender}</strong>
          <small>{latestMessage.department}</small>
        </div>
        <button type="button" onClick={onClose} aria-label="Close office chat">x</button>
      </header>
      <div className="office-chat-log">
        {messages.slice(-6).map((message) => (
          <article className={message.id === latestMessage.id ? "latest" : ""} key={message.id}>
            <span>{message.sender}</span>
            <p>{message.text}</p>
          </article>
        ))}
      </div>
      {messages.length > 6 && <small className="office-chat-older">{messages.length - 6} older messages were buried by the office</small>}
    </aside>
  );
}

function getInitials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
