import { describe, expect, it } from "vitest";
import { challengeState, explainAction, reasonRefs, releaseReasonWords, snippet } from "./explain";

describe("Why? explanations", () => {
  it("uses the reasons agents already give", () => {
    expect(explainAction({ action: "issue.validated", payload: { checked: " Chrome 131, three runs " }, validationNotes: "Could not reproduce." }))
      .toEqual({ why: "Could not reproduce.", checked: "Chrome 131, three runs" });
    expect(explainAction({ action: "issue.test_verdict", payload: {}, verdictNotes: "Both tests pass." }).why).toBe("Both tests pass.");
    expect(explainAction({ action: "issue.test_verdict_changed", payload: {}, verdictNotes: "Now fails." }).why).toBe("Now fails.");
    expect(explainAction({ action: "issue.bid", payload: { checked: "The rate-limit code" }, bidNote: "I fixed this area last week." }))
      .toEqual({ why: "I fixed this area last week.", checked: "The rate-limit code" });
  });

  it("prefers the agent's own words for a release, then explains the release code", () => {
    expect(explainAction({ action: "claim.released", payload: { reason: "agent", note: "Needs a database change." } }).why)
      .toBe("Needs a database change.");
    expect(explainAction({ action: "claim.released", payload: { reason: "deadline" } }).why).toMatch(/deadline passed/);
    expect(releaseReasonWords("something_new")).toBe("The claim was released (something new).");
    expect(releaseReasonWords(null)).toBeNull();
  });

  it("has no reason when none was recorded, and ignores blank text", () => {
    expect(explainAction({ action: "comment.created", payload: null })).toEqual({ why: null, checked: null });
    expect(explainAction({ action: "issue.validated", payload: { checked: "   " }, validationNotes: "  " })).toEqual({ why: null, checked: null });
  });

  it("finds the row behind each reasoned action", () => {
    expect(reasonRefs("issue.validated", { validationId: "v1" })).toEqual({ validationId: "v1" });
    expect(reasonRefs("issue.test_verdict_changed", { verdictId: "t1" })).toEqual({ verdictId: "t1" });
    expect(reasonRefs("issue.bid", { bidId: "b1" })).toEqual({ bidId: "b1" });
    expect(reasonRefs("issue.bid", "not an object")).toEqual({ bidId: undefined });
    expect(reasonRefs("claim.released", { claimId: "c1" })).toEqual({});
  });

  it("stays challenged until every disagreement is answered", () => {
    expect(challengeState([])).toBeNull();
    expect(challengeState([{ verdict: "makes_sense", repliedAt: null }])).toBeNull();
    expect(challengeState([{ verdict: "disagree", repliedAt: null }, { verdict: "disagree", repliedAt: new Date() }])).toBe("challenged");
    expect(challengeState([{ verdict: "disagree", repliedAt: new Date() }])).toBe("answered");
  });

  it("shortens text for notifications", () => {
    expect(snippet("one\n two   three")).toBe("one two three");
    expect(snippet("a".repeat(100), 10)).toBe(`${"a".repeat(9)}…`);
  });
});
