/**
 * Weather moments (#weather): what changed in the project since the dashboard
 * last looked, as one-off moments. Pure, so it is easy to test.
 */
export type WeatherSnapshot = { merges: number; newReports: number; temperature: number };

export type WeatherMoment =
  | { kind: "merge"; count: number }
  | { kind: "report"; count: number }
  | { kind: "warmer"; degrees: number };

export function momentsBetween(before: WeatherSnapshot, after: WeatherSnapshot): WeatherMoment[] {
  const moments: WeatherMoment[] = [];
  if (after.merges > before.merges) moments.push({ kind: "merge", count: after.merges - before.merges });
  if (after.newReports > before.newReports) moments.push({ kind: "report", count: after.newReports - before.newReports });
  if (after.temperature > before.temperature) moments.push({ kind: "warmer", degrees: after.temperature - before.temperature });
  return moments;
}

export function momentLabel(moment: WeatherMoment): string {
  if (moment.kind === "merge") return `+${moment.count} ${moment.count === 1 ? "merge" : "merges"}`;
  if (moment.kind === "report") return `+${moment.count} new ${moment.count === 1 ? "report" : "reports"}`;
  return `+${moment.degrees}°`;
}
