/**
 * Drag and drop for "Agents in the room": a dashboard card, an assigned issue
 * or a drifting cloud is dragged onto one of the person's robots. The item
 * travels in the drag data under its own type, so nothing else on the page
 * reacts to it, and window events tell the robots to light up as targets.
 */
import type { HandOffItemType } from "@/lib/handoff/presets";

export const HANDOFF_MIME = "application/x-ziki-handoff";
export const DRAG_START_EVENT = "ziki:handoff-drag-start";
export const DRAG_END_EVENT = "ziki:handoff-drag-end";
/** The header weather chip asks the dashboard clouds to show their titles. */
export const CHECK_WEATHER_EVENT = "ziki:check-weather";

export type HandOffDragItem = {
  itemType: HandOffItemType;
  itemId: string;
  itemTitle: string;
  requests: string[];
};

export function encodeDragItem(item: HandOffDragItem): string {
  return JSON.stringify(item);
}

/** The dragged item, or null for anything that isn't one of ours. */
export function decodeDragItem(raw: string | null | undefined): HandOffDragItem | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<HandOffDragItem>;
    if ((value.itemType !== "stat" && value.itemType !== "issue") || typeof value.itemId !== "string" || !value.itemId) return null;
    if (typeof value.itemTitle !== "string" || !Array.isArray(value.requests)) return null;
    const requests = value.requests.filter((r): r is string => typeof r === "string" && r.trim().length > 0).slice(0, 3);
    if (!requests.length) return null;
    return { itemType: value.itemType, itemId: value.itemId, itemTitle: value.itemTitle.slice(0, 200), requests };
  } catch {
    return null;
  }
}

/** Starts a drag of `item`: sets the data and tells the robots. */
export function startHandOffDrag(dataTransfer: DataTransfer | null, item: HandOffDragItem): void {
  if (dataTransfer) {
    dataTransfer.setData(HANDOFF_MIME, encodeDragItem(item));
    dataTransfer.setData("text/plain", item.itemTitle);
    dataTransfer.effectAllowed = "move";
  }
  window.dispatchEvent(new CustomEvent(DRAG_START_EVENT));
}

export function endHandOffDrag(): void {
  window.dispatchEvent(new CustomEvent(DRAG_END_EVENT));
}

/** True while something of ours is being dragged over a target. */
export function isHandOffDrag(types: ReadonlyArray<string> | DOMStringList | null | undefined): boolean {
  if (!types) return false;
  return Array.from(types as ArrayLike<string>).includes(HANDOFF_MIME);
}
