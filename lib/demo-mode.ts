/**
 * Showcase demo: no sign-in at all. Every visitor is the seeded demo person,
 * so the deployment can be opened straight from a link. Never on a real
 * deployment: anyone with the link acts as that person.
 */
export const DEMO_USER_EMAIL = "demo@ziki.dev";

/**
 * This branch (demo/showcase) is the showcase build, so demo mode is on even
 * when ZIKI_DEMO is missing from the host's settings. Set ZIKI_DEMO=false to
 * turn it off. Leave this file out of any pull request to main.
 */
export const SHOWCASE_BUILD = true;

export function isDemoMode(
  env: Record<string, string | undefined> = process.env,
  showcaseBuild: boolean = SHOWCASE_BUILD,
): boolean {
  const flag = env.ZIKI_DEMO?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  // Unit tests keep the normal signed-in behaviour unless they switch it on.
  return showcaseBuild && env.NODE_ENV !== "test";
}

/** Public weather pages: always in the demo, otherwise only when switched on. */
export function isWeatherPublic(
  env: Record<string, string | undefined> = process.env,
  showcaseBuild: boolean = SHOWCASE_BUILD,
): boolean {
  return isDemoMode(env, showcaseBuild) || env.WEATHER_PUBLIC?.trim().toLowerCase() === "true";
}
