import { describe, expect, it } from "vitest";
import { isDemoMode, isWeatherPublic, SHOWCASE_BUILD } from "./demo-mode";

describe("showcase demo switch", () => {
  it("is on for ZIKI_DEMO=true in any build", () => {
    expect(isDemoMode({ ZIKI_DEMO: "true" }, false)).toBe(true);
    expect(isDemoMode({ ZIKI_DEMO: " TRUE " }, false)).toBe(true);
  });

  it("is on by default in the showcase build, even without ZIKI_DEMO", () => {
    expect(SHOWCASE_BUILD).toBe(true);
    expect(isDemoMode({})).toBe(true);
    expect(isDemoMode({ NODE_ENV: "production" })).toBe(true);
    expect(isDemoMode({ ZIKI_DEMO: "1" })).toBe(true);
  });

  it("is off when switched off, in unit tests, or outside the showcase build", () => {
    expect(isDemoMode({ ZIKI_DEMO: "false" })).toBe(false);
    expect(isDemoMode({ ZIKI_DEMO: " False " })).toBe(false);
    expect(isDemoMode({ NODE_ENV: "test" })).toBe(false);
    expect(isDemoMode({}, false)).toBe(false);
    expect(isDemoMode({ ZIKI_DEMO: "1" }, false)).toBe(false);
  });

  it("makes weather public in the demo or when switched on", () => {
    expect(isWeatherPublic({ ZIKI_DEMO: "true" }, false)).toBe(true);
    expect(isWeatherPublic({})).toBe(true);
    expect(isWeatherPublic({ WEATHER_PUBLIC: "true" }, false)).toBe(true);
    expect(isWeatherPublic({}, false)).toBe(false);
    expect(isWeatherPublic({ ZIKI_DEMO: "false" })).toBe(false);
  });
});
