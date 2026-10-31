import { describe, expect, it } from "vitest";
import { decodeDragItem, encodeDragItem, HANDOFF_MIME, isHandOffDrag } from "./drag";

describe("hand-off drag data", () => {
  const item = { itemType: "issue" as const, itemId: "b1", itemTitle: "#544 Export", requests: ["Investigate and draft a fix plan"] };

  it("round-trips an item", () => {
    expect(decodeDragItem(encodeDragItem(item))).toEqual(item);
  });

  it("ignores anything that isn't a hand-off item", () => {
    expect(decodeDragItem(null)).toBeNull();
    expect(decodeDragItem("not json")).toBeNull();
    expect(decodeDragItem(JSON.stringify({ ...item, itemType: "page" }))).toBeNull();
    expect(decodeDragItem(JSON.stringify({ ...item, requests: [] }))).toBeNull();
  });

  it("keeps at most three requests", () => {
    const many = { ...item, requests: ["a", "b", "c", "d"] };
    expect(decodeDragItem(encodeDragItem(many))?.requests).toEqual(["a", "b", "c"]);
  });

  it("recognises its own drags only", () => {
    expect(isHandOffDrag([HANDOFF_MIME, "text/plain"])).toBe(true);
    expect(isHandOffDrag(["Files"])).toBe(false);
    expect(isHandOffDrag(null)).toBe(false);
  });
});
