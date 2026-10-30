/**
 * "Point and hand off" on the dashboard: what an agent can do with each item.
 * Pure wording, three requests per item, in the order the menu shows them.
 */

export const HANDOFF_ITEM_TYPES = ["stat", "issue"] as const;
export type HandOffItemType = (typeof HANDOFF_ITEM_TYPES)[number];

/** The four stat cards, by the label the dashboard shows. */
export const STAT_KEYS = {
  Points: "points",
  "Created by me": "created",
  "Assigned to me": "assigned",
  "Resolved issues": "resolved",
} as const;
export type StatKey = (typeof STAT_KEYS)[keyof typeof STAT_KEYS];

export const HANDOFF_REQUEST_MAX = 300;

export function statRequests(key: StatKey, context: { pointsToGo: number }): string[] {
  switch (key) {
    case "points":
      return [
        context.pointsToGo > 0 ? `Find me work worth ${context.pointsToGo} points` : "Find me my next piece of work",
        "Review my recent validations for anything I missed",
        "Check what is blocking my open claims",
      ];
    case "created":
      return [
        "Find my reports that are missing steps or details",
        "Check whether any of my reports are duplicates",
        "Ask reviewers to look at my oldest open report",
      ];
    case "assigned":
      return [
        "Rank my assigned issues by what to fix first",
        "Check which of them still happen on the latest build",
        "Draft fix plans for my two oldest issues",
      ];
    case "resolved":
      return [
        "Summarise what I resolved this week",
        "Check that my recent fixes stayed fixed",
        "Find follow-up work from my resolved issues",
      ];
  }
}

export function issueRequests(): string[] {
  return [
    "Investigate and draft a fix plan",
    "Check it still happens on the latest build",
    "Ask the reporter for what's missing",
  ];
}

/** What the agents table shows while the agent works on it. */
export function handOffActivity(handOff: { request: string; itemTitle: string; progressNote: string | null }): string {
  return handOff.progressNote?.trim() || `${handOff.request} · ${handOff.itemTitle}`;
}

/** Hand-offs that are still with the agent. */
export const OPEN_HANDOFF_STATUSES = ["offered", "accepted", "in_progress"] as const;
export function isOpenHandOff(status: string): boolean {
  return (OPEN_HANDOFF_STATUSES as readonly string[]).includes(status);
}
