import { describe, expect, it } from "vitest";
import { conditionFor, editionAt, forecastFor, temperatureFor, type WeatherInput } from "./forecast";
import { badgeSvg } from "./badge";

const LAGOS = "Africa/Lagos";
// 13:30 in Lagos (UTC+1).
const AFTERNOON = new Date("2026-10-28T12:30:00Z");

function input(over: Partial<WeatherInput> = {}): WeatherInput {
  return {
    now: AFTERNOON,
    timeZone: LAGOS,
    projectName: "Ziki",
    merges24h: 4,
    newReports24h: 12,
    duplicateReports24h: 0,
    agentActionsLastHour: 25,
    criticalOpen: 0,
    stuck: [
      { id: "a", number: 544, title: "Delivered fix shows no pull request", waitingDays: 5, state: "pr_waiting" },
      { id: "b", number: 512, title: "Settings page loads slowly", waitingDays: 3, state: "awaiting_review" },
    ],
    stuckTotal: 4,
    clearedToday: 1,
    history: [],
    ...over,
  };
}

describe("Ziki weather forecast (#weather)", () => {
  it.each([
    ["07:30", "evening"],
    ["08:00", "morning"],
    ["12:59", "morning"],
    ["13:00", "afternoon"],
    ["17:59", "afternoon"],
    ["18:00", "evening"],
  ])("Lagos %s is the %s edition", (time, edition) => {
    // Lagos is UTC+1 all year.
    const [h, m] = time.split(":").map(Number);
    const utc = new Date(Date.UTC(2026, 9, 28, h - 1, m));
    expect(editionAt(utc, LAGOS)).toBe(edition);
  });

  it("titles and dates each edition", () => {
    const f = forecastFor(input());
    expect(f.edition).toBe("afternoon");
    expect(f.editionTitle).toBe("The afternoon update");
    expect(f.editionTime).toBe("1:00pm");
    expect(f.dateLabel).toBe("Wednesday 28 October");
  });

  it("writes each edition's bulletin from the numbers", () => {
    const morning = forecastFor(input({ now: new Date("2026-10-28T08:00:00Z") }));
    expect(morning.bulletin).toMatch(/^Good morning!/);
    expect(morning.bulletin).toContain("4 clouds hanging over the review queue.");
    expect(morning.bulletin).toContain("12 new reports came down since yesterday.");
    expect(morning.bulletin).toContain("NEPA is holding steady: no critical issues open.");

    const afternoon = forecastFor(input());
    expect(afternoon.bulletin).toContain("4 merges so far.");
    expect(afternoon.bulletin).toContain("Agent winds are brisk.");
    expect(afternoon.bulletin).toContain("Clear 2 more clouds and tomorrow turns sunny.");

    const evening = forecastFor(input({ now: new Date("2026-10-28T18:30:00Z"), stuck: [], stuckTotal: 0, criticalOpen: 2 }));
    expect(evening.bulletin).toMatch(/^Evening!/);
    expect(evening.bulletin).toContain("Clear skies over the review queue.");
    expect(evening.bulletin).toContain("A calm night ahead.");
  });

  it("mentions duplicates and critical issues only when there are some", () => {
    const f = forecastFor(input({ now: new Date("2026-10-28T08:00:00Z"), duplicateReports24h: 3, criticalOpen: 1 }));
    expect(f.bulletin).toContain("Harmattan haze of duplicates: 3 new reports already reported before.");
    expect(f.bulletin).toContain("Light dey blink: 1 critical issue open.");
  });

  it.each([
    [0, 0, "sunny"],
    [2, 0, "mostly_sunny"],
    [4, 0, "partly_cloudy"],
    [8, 0, "cloudy"],
    [0, 20, "showers"],
  ])("%i clouds and %i reports is %s", (clouds, reports, condition) => {
    expect(conditionFor(clouds, reports)).toBe(condition);
  });

  it("keeps the temperature between 15° and 38°", () => {
    expect(temperatureFor({ merges24h: 0, newReports24h: 0, agentActionsLastHour: 0 })).toBe(18);
    expect(temperatureFor({ merges24h: 50, newReports24h: 50, agentActionsLastHour: 500 })).toBe(38);
  });

  it("turns the stuck issues into clouds with a note on what they wait for", () => {
    const f = forecastFor(input());
    expect(f.cloudTotal).toBe(4);
    expect(f.clouds[0]).toMatchObject({ number: 544, waitingLabel: "5 days", note: "Its pull request is waiting on a reviewer." });
    expect(f.clouds[1].note).toBe("Waiting for its first review.");
    expect(f.headline).toBe("Partly cloudy, 4 clouds over the review queue.");
  });

  it("says how many clouds to clear for a sunny tomorrow, counting today's", () => {
    const f = forecastFor(input());
    expect(f.tomorrow).toMatchObject({ outlook: "partly_cloudy", cleared: 1, target: 3 });
    expect(f.tomorrow.note).toBe("Clear 2 more clouds today and tomorrow turns sunny.");
    const clear = forecastFor(input({ stuck: [], stuckTotal: 1 }));
    expect(clear.tomorrow.outlook).toBe("sunny");
  });

  it("puts out a merge rainbow at 10 merges and records rare days in the diary", () => {
    expect(forecastFor(input({ merges24h: 9 })).rainbow).toBe(false);
    expect(forecastFor(input({ merges24h: 10 })).rainbow).toBe(true);
    const f = forecastFor(
      input({
        history: [
          { day: "2026-10-26", merges: 2, reviews: 40 },
          { day: "2026-10-27", merges: 1, reviews: 3 },
          { day: "2026-10-28", merges: 11, reviews: 5 },
        ],
      }),
    );
    expect(f.diary).toEqual([
      { kind: "rainbow", label: "Merge rainbow", detail: "Today · 11 merges" },
      { kind: "thunderstorm", label: "Review thunderstorm", detail: "Mon 26 Oct · 40 reviews" },
    ]);
  });

  it("labels rain and wind", () => {
    expect(forecastFor(input({ newReports24h: 0 })).rain.label).toBe("Dry · no new reports");
    expect(forecastFor(input()).rain.label).toBe("Light rain · 12 new reports");
    expect(forecastFor(input({ agentActionsLastHour: 3 })).wind.label).toBe("Calm agent winds · 3 actions/hr");
  });

  it("builds an escaped SVG badge", () => {
    const svg = badgeSvg(`Mostly sunny · 31°`);
    expect(svg).toContain("Ziki weather: Mostly sunny · 31°");
    expect(badgeSvg("<x>")).toContain("&lt;x&gt;");
  });
});
