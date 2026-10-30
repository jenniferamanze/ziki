"use client";

import { useRef, useState, type ElementType, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { HandOffMenu, type HandOffAgent } from "@/components/hand-off-menu";
import type { HandOffItemType } from "@/lib/handoff/presets";

const LONG_PRESS_MS = 550;

/**
 * "Point and hand off" around an existing dashboard item. A normal click
 * behaves exactly as before. Alt+click (Option+click on a Mac), a long press
 * on a phone, or Alt+Enter on the focused item opens a small menu of three
 * things an agent can do with it.
 */
export function HandOffZone({
  as: Tag = "div",
  className = "",
  itemType,
  itemId,
  itemTitle,
  requests,
  agents,
  children,
}: {
  as?: ElementType;
  className?: string;
  itemType: HandOffItemType;
  itemId: string;
  itemTitle: string;
  requests: string[];
  agents: HandOffAgent[];
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const timer = useRef<number | null>(null);
  const pressed = useRef(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  function openAt(x: number, y: number) {
    const width = 296;
    setMenu({ x: Math.max(8, Math.min(x, window.innerWidth - width - 8)), y: Math.min(y + 8, window.innerHeight - 280) });
  }

  function openBelowItem() {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) openAt(rect.left + 16, rect.top + Math.min(rect.height, 64));
  }

  function onClickCapture(event: MouseEvent) {
    // Clicks inside the open menu are the menu's own.
    if ((event.target as HTMLElement | null)?.closest?.("[data-handoff-menu]")) return;
    if (pressed.current) {
      // The long press already opened the menu; swallow the click that follows.
      pressed.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    openAt(event.clientX, event.clientY);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.altKey && event.key === "Enter") {
      event.preventDefault();
      openBelowItem();
    }
  }

  function clearTimer() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }

  function onPointerDown(event: PointerEvent) {
    if ((event.target as HTMLElement | null)?.closest?.("[data-handoff-menu]")) return;
    pressed.current = false;
    if (event.pointerType !== "touch") return;
    const { clientX, clientY } = event;
    clearTimer();
    timer.current = window.setTimeout(() => {
      pressed.current = true;
      openAt(clientX, clientY);
    }, LONG_PRESS_MS);
  }

  return (
    <Tag
      ref={ref}
      className={`relative ${className}`}
      data-handoff-item={itemTitle}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(event: MouseEvent) => { if (pressed.current) event.preventDefault(); }}
    >
      {children}
      {menu ? (
        <HandOffMenu
          x={menu.x}
          y={menu.y}
          itemType={itemType}
          itemId={itemId}
          itemTitle={itemTitle}
          requests={requests}
          agents={agents}
          onClose={() => {
            setMenu(null);
            pressed.current = false;
          }}
        />
      ) : null}
    </Tag>
  );
}
