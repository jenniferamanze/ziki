/**
 * "Why?" on agent actions (Activity page). Pure wording: the reason an agent
 * gave when it acted ("Why I did this") and what it says it checked ("What I
 * checked"). The reasons are the ones agents already give: validation notes,
 * bid notes, test-verdict notes and release reasons. `checked` is the optional
 * field agents send with those calls (lib/why/limits.ts).
 */

/** What the loader read for one audit row. Never sent to the browser as is. */
export type WhyFacts = {
  action: string;
  /** The audit row's payload (server only). */
  payload: unknown;
  validationNotes?: string | null;
  verdictNotes?: string | null;
  bidNote?: string | null;
};

export type WhyExplanation = {
  /** The agent's reason in its own words, or a plain account of a system release. */
  why: string | null;
  /** What the agent says it checked first. */
  checked: string | null;
};

/** Why a claim ended, for releases the agent did not explain itself. */
const RELEASE_WORDS: Record<string, string> = {
  agent: "I gave the work back.",
  declined: "I declined the offer.",
  silence: "Ziki released the claim because I stopped sending heartbeats.",
  deadline: "Ziki released the claim because the delivery deadline passed.",
  expired: "The offer expired before I accepted it.",
  undo: "A workspace admin undid this claim.",
  resolved: "The issue was resolved.",
  closed: "The issue was closed.",
  owner_unresponsive: "My owner did not answer my question in time, so the work went back.",
  revoked: "My key was revoked, so the claim was released.",
  capacity: "My owner already holds as many claims as the project allows.",
  unavailable: "The issue was no longer available to take.",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function words(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function releaseReasonWords(code: unknown): string | null {
  const key = words(code);
  if (!key) return null;
  return RELEASE_WORDS[key] ?? `The claim was released (${key.replace(/_/g, " ")}).`;
}

export function explainAction(facts: WhyFacts): WhyExplanation {
  const payload = record(facts.payload);
  const checked = words(payload.checked);
  switch (facts.action) {
    case "issue.validated":
      return { why: words(facts.validationNotes), checked };
    case "issue.test_verdict":
    case "issue.test_verdict_changed":
      return { why: words(facts.verdictNotes), checked };
    case "issue.bid":
      return { why: words(facts.bidNote), checked };
    case "claim.released":
      return { why: words(payload.note) ?? releaseReasonWords(payload.reason), checked };
    default:
      return { why: null, checked };
  }
}

/** The ids the loader needs to read the reasons behind a row. */
export function reasonRefs(action: string, payload: unknown): { validationId?: string; verdictId?: string; bidId?: string } {
  const data = record(payload);
  const id = (key: string) => words(data[key]) ?? undefined;
  switch (action) {
    case "issue.validated":
      return { validationId: id("validationId") };
    case "issue.test_verdict":
    case "issue.test_verdict_changed":
      return { verdictId: id("verdictId") };
    case "issue.bid":
      return { bidId: id("bidId") };
    default:
      return {};
  }
}

export type FeedbackVerdict = "makes_sense" | "disagree";

export type ChallengeState = "challenged" | "answered" | null;

/** An action stays "challenged" while any disagreement is unanswered. */
export function challengeState(feedback: { verdict: string; repliedAt: Date | null }[]): ChallengeState {
  const challenges = feedback.filter((row) => row.verdict === "disagree");
  if (!challenges.length) return null;
  return challenges.some((row) => !row.repliedAt) ? "challenged" : "answered";
}

/** A short line for notifications: the first 80 characters, on one line. */
export function snippet(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
