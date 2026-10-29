/**
 * Showcase demo (ZIKI_DEMO=true): no sign-in at all. Every visitor is the
 * seeded demo person, so the deployment can be opened from a link. Never set
 * this on a real deployment: anyone with the link acts as that person.
 */
export const DEMO_USER_EMAIL = "demo@ziki.dev";

export function isDemoMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.ZIKI_DEMO?.trim().toLowerCase() === "true";
}

/** Public weather pages: always in the demo, otherwise only when switched on. */
export function isWeatherPublic(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isDemoMode(env) || env.WEATHER_PUBLIC?.trim().toLowerCase() === "true";
}
