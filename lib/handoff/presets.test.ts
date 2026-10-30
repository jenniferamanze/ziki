import { describe, expect, it } from "vitest";
import { handOffActivity, isOpenHandOff, issueRequests, statRequests, STAT_KEYS } from "./presets";

describe("Point and hand off requests", () => {
  it("offers three requests for each of the four stat cards", () => {
    expect(Object.keys(STAT_KEYS)).toEqual(["Points", "Created by me", "Assigned to me", "Resolved issues"]);
    for (const key of Object.values(STAT_KEYS)) expect(statRequests(key, { pointsToGo: 260 })).toHaveLength(3);
    expect(issueRequests()).toEqual([
      "Investigate and draft a fix plan",
      "Check it still happens on the latest build",
      "Ask the reporter for what's missing",
    ]);
  });

  it("names the points still to go", () => {
    expect(statRequests("points", { pointsToGo: 260 })[0]).toBe("Find me work worth 260 points");
    expect(statRequests("points", { pointsToGo: 0 })[0]).toBe("Find me my next piece of work");
  });

  it("shows the agent's note, else what was asked", () => {
    expect(handOffActivity({ request: "Investigate and draft a fix plan", itemTitle: "#544 Export", progressNote: null }))
      .toBe("Investigate and draft a fix plan · #544 Export");
    expect(handOffActivity({ request: "x", itemTitle: "y", progressNote: "Reading the logs" })).toBe("Reading the logs");
  });

  it("treats only unfinished hand-offs as open", () => {
    expect(["offered", "accepted", "in_progress"].every(isOpenHandOff)).toBe(true);
    expect(isOpenHandOff("completed")).toBe(false);
    expect(isOpenHandOff("released")).toBe(false);
  });
});
