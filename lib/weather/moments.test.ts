import { describe, expect, it } from "vitest";
import { momentLabel, momentsBetween } from "./moments";

describe("weather moments", () => {
  const base = { merges: 11, newReports: 12, temperature: 31 };

  it("turns what changed into moments", () => {
    expect(momentsBetween(base, { merges: 12, newReports: 14, temperature: 33 })).toEqual([
      { kind: "merge", count: 1 },
      { kind: "report", count: 2 },
      { kind: "warmer", degrees: 2 },
    ]);
  });

  it("stays quiet when nothing went up", () => {
    expect(momentsBetween(base, base)).toEqual([]);
    expect(momentsBetween(base, { merges: 10, newReports: 11, temperature: 30 })).toEqual([]);
  });

  it("labels each moment", () => {
    expect(momentLabel({ kind: "merge", count: 1 })).toBe("+1 merge");
    expect(momentLabel({ kind: "report", count: 3 })).toBe("+3 new reports");
    expect(momentLabel({ kind: "warmer", degrees: 2 })).toBe("+2°");
  });
});
