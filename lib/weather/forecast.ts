/**
 * Ziki weather: a project's real numbers told as a forecast (#weather).
 * Pure functions only, so every phrase is testable and never made up: each
 * one is a template filled with a number from lib/weather/load.ts.
 */

export type StuckIssue = {
  id: string;
  number: number;
  title: string;
  /** Whole days since anything happened on it. */
  waitingDays: number;
  /** open: no review yet; in_progress with a PR: waiting on reviewers; without: no PR yet. */
  state: "awaiting_review" | "pr_waiting" | "no_pr";
};

export type WeatherDay = { day: string; merges: number; reviews: number };

export type WeatherInput = {
  now: Date;
  timeZone: string;
  projectName: string;
  merges24h: number;
  newReports24h: number;
  duplicateReports24h: number;
  agentActionsLastHour: number;
  criticalOpen: number;
  /** Issues untouched for more than two days, oldest first (at most a few shown). */
  stuck: StuckIssue[];
  /** How many issues are stuck in total, beyond the ones listed. */
  stuckTotal: number;
  /** Long-waiting issues resolved today: the clouds the team already cleared. */
  clearedToday: number;
  /** The last 7 local days, oldest first. */
  history: WeatherDay[];
};

export type Edition = "morning" | "afternoon" | "evening";
export type Condition = "sunny" | "mostly_sunny" | "partly_cloudy" | "cloudy" | "showers";

export type Forecast = {
  edition: Edition;
  editionTitle: string;
  editionTime: string;
  dateLabel: string;
  condition: Condition;
  conditionLabel: string;
  temperature: number;
  temperatureWord: string;
  headline: string;
  bulletin: string;
  rain: { level: "none" | "light" | "steady" | "heavy"; label: string; count: number; duplicates: number };
  wind: { level: "calm" | "brisk" | "strong"; label: string; perHour: number };
  clouds: Array<StuckIssue & { waitingLabel: string; note: string }>;
  cloudTotal: number;
  rainbow: boolean;
  tomorrow: { outlook: "sunny" | "partly_cloudy"; label: string; note: string; cleared: number; target: number };
  diary: Array<{ kind: "rainbow" | "thunderstorm"; label: string; detail: string }>;
  badge: string;
};

export const STUCK_AFTER_DAYS = 2;
export const RAINBOW_MERGES = 10;
export const THUNDERSTORM_REVIEWS = 30;
/** Clouds the team can live with before tomorrow turns grey. */
export const CLOUDS_ALLOWED = 2;

const EDITION_TIME: Record<Edition, string> = { morning: "8:00am", afternoon: "1:00pm", evening: "6:00pm" };
const EDITION_TITLE: Record<Edition, string> = {
  morning: "The morning bulletin",
  afternoon: "The afternoon update",
  evening: "The evening report",
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function localHour(now: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(now);
  return Number(hour);
}

/** Three editions a day: 8am, 1pm and 6pm in the project's time zone. */
export function editionAt(now: Date, timeZone: string): Edition {
  const hour = localHour(now, timeZone);
  if (hour >= 18 || hour < 8) return "evening";
  if (hour >= 13) return "afternoon";
  return "morning";
}

export function conditionFor(clouds: number, newReports: number): Condition {
  if (newReports >= 15) return "showers";
  if (clouds === 0) return "sunny";
  if (clouds <= 2) return "mostly_sunny";
  if (clouds <= 5) return "partly_cloudy";
  return "cloudy";
}

const CONDITION_LABEL: Record<Condition, string> = {
  sunny: "Sunny",
  mostly_sunny: "Mostly sunny",
  partly_cloudy: "Partly cloudy",
  cloudy: "Cloudy",
  showers: "Showers",
};

/** How busy the project feels: merges count most, then reports and agent activity. */
export function temperatureFor(input: Pick<WeatherInput, "merges24h" | "newReports24h" | "agentActionsLastHour">): number {
  const raw = 18 + input.merges24h * 2 + input.newReports24h * 0.5 + input.agentActionsLastHour * 0.2;
  return Math.max(15, Math.min(38, Math.round(raw)));
}

function temperatureWord(t: number): string {
  if (t >= 32) return "Hot. A very busy day.";
  if (t >= 26) return "Warm. A busy day.";
  if (t >= 21) return "Mild. A steady day.";
  return "Cool. A quiet day.";
}

function rainFor(count: number, duplicates: number): Forecast["rain"] {
  const level = count === 0 ? "none" : count <= 12 ? "light" : count <= 24 ? "steady" : "heavy";
  const word = { none: "Dry", light: "Light rain", steady: "Steady rain", heavy: "Heavy rain" }[level];
  return { level, count, duplicates, label: count === 0 ? "Dry · no new reports" : `${word} · ${plural(count, "new report")}` };
}

function windFor(perHour: number): Forecast["wind"] {
  const level = perHour < 10 ? "calm" : perHour < 40 ? "brisk" : "strong";
  const word = { calm: "Calm", brisk: "Brisk", strong: "Strong" }[level];
  return { level, perHour, label: `${word} agent winds · ${perHour} actions/hr` };
}

function waitingLabel(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

function cloudNote(state: StuckIssue["state"]): string {
  if (state === "pr_waiting") return "Its pull request is waiting on a reviewer.";
  if (state === "no_pr") return "Being worked on, but no pull request yet.";
  return "Waiting for its first review.";
}

function lightLine(criticalOpen: number): string {
  return criticalOpen === 0
    ? "NEPA is holding steady: no critical issues open."
    : `Light dey blink: ${plural(criticalOpen, "critical issue")} open.`;
}

function bulletinFor(edition: Edition, f: { clouds: number; rain: Forecast["rain"]; wind: Forecast["wind"]; merges: number; rainbow: boolean; criticalOpen: number; toClear: number }): string {
  const rainLine =
    f.rain.count === 0
      ? "No new reports so far."
      : f.rain.duplicates > 0
        ? `A light Harmattan haze of duplicates: ${plural(f.rain.duplicates, "new report")} already reported before.`
        : `${plural(f.rain.count, "new report")} came down since yesterday.`;
  const cloudLine =
    f.clouds === 0
      ? "Clear skies over the review queue."
      : `${plural(f.clouds, "cloud")} hanging over the review queue.`;
  const mergeLine = f.rainbow
    ? `A merge rainbow is out: ${f.merges} merges in a day!`
    : f.merges > 0
      ? `${plural(f.merges, "merge")} so far.`
      : "No merges yet.";
  const nudge =
    f.toClear > 0
      ? `Clear ${plural(f.toClear, "more cloud")} and tomorrow turns sunny.`
      : "Keep it up and tomorrow stays bright.";

  if (edition === "morning") {
    return `Good morning! ${cloudLine} ${rainLine} ${lightLine(f.criticalOpen)} Jenie says: take one review before your first coffee.`;
  }
  if (edition === "afternoon") {
    return `Afternoon, everyone. ${mergeLine} Agent winds are ${f.wind.level}. ${cloudLine} ${nudge}`;
  }
  return `Evening! ${mergeLine} ${cloudLine} ${f.clouds > 0 ? "One kind review tonight and they'll be gone by morning." : "A calm night ahead."}`;
}

function dayLabel(day: string, now: Date, timeZone: string): string {
  const today = localDay(now, timeZone);
  if (day === today) return "Today";
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** YYYY-MM-DD in the project's time zone. */
export function localDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(date);
}

export function forecastFor(input: WeatherInput): Forecast {
  const edition = editionAt(input.now, input.timeZone);
  const cloudTotal = Math.max(input.stuckTotal, input.stuck.length);
  const condition = conditionFor(cloudTotal, input.newReports24h);
  const temperature = temperatureFor(input);
  const rain = rainFor(input.newReports24h, input.duplicateReports24h);
  const wind = windFor(input.agentActionsLastHour);
  const rainbow = input.merges24h >= RAINBOW_MERGES;
  const toClear = Math.max(0, cloudTotal - CLOUDS_ALLOWED);

  const headline =
    cloudTotal === 0
      ? "Clear skies. Nothing is stuck."
      : `${CONDITION_LABEL[condition]}, ${plural(cloudTotal, "cloud")} over the review queue.`;

  const diary: Forecast["diary"] = [];
  for (const day of [...input.history].reverse()) {
    if (day.merges >= RAINBOW_MERGES) {
      diary.push({ kind: "rainbow", label: "Merge rainbow", detail: `${dayLabel(day.day, input.now, input.timeZone)} · ${day.merges} merges` });
    } else if (day.reviews >= THUNDERSTORM_REVIEWS) {
      diary.push({ kind: "thunderstorm", label: "Review thunderstorm", detail: `${dayLabel(day.day, input.now, input.timeZone)} · ${day.reviews} reviews` });
    }
    if (diary.length >= 3) break;
  }

  return {
    edition,
    editionTitle: EDITION_TITLE[edition],
    editionTime: EDITION_TIME[edition],
    dateLabel: new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: input.timeZone }).format(input.now),
    condition,
    conditionLabel: CONDITION_LABEL[condition],
    temperature,
    temperatureWord: temperatureWord(temperature),
    headline,
    bulletin: bulletinFor(edition, { clouds: cloudTotal, rain, wind, merges: input.merges24h, rainbow, criticalOpen: input.criticalOpen, toClear }),
    rain,
    wind,
    clouds: input.stuck.map((issue) => ({ ...issue, waitingLabel: waitingLabel(issue.waitingDays), note: cloudNote(issue.state) })),
    cloudTotal,
    rainbow,
    tomorrow: {
      outlook: toClear === 0 ? "sunny" : "partly_cloudy",
      label: toClear === 0 ? "Sunny" : "Partly cloudy",
      note:
        toClear === 0
          ? "Nothing much is stuck. Tomorrow starts with blue skies."
          : `Clear ${plural(toClear, "more cloud")} today and tomorrow turns sunny.`,
      cleared: input.clearedToday,
      target: input.clearedToday + toClear,
    },
    diary,
    badge: `${CONDITION_LABEL[condition]} · ${temperature}°`,
  };
}
