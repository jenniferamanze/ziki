import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { pulseKindAt, PULSE_MS } from "./pulse";

describe("showcase pulse", () => {
  it("takes turns: a report, a merge, then a cloud cleared", () => {
    expect([0, 1, 2, 3].map((slot) => pulseKindAt(slot * PULSE_MS))).toEqual(["report", "merge", "unstick", "report"]);
  });
});
