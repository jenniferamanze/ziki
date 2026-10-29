import { describe, expect, it } from "vitest";
import { isDemoMode, isWeatherPublic } from "./demo-mode";

describe("showcase demo switch", () => {
  it("is on only for ZIKI_DEMO=true", () => {
    expect(isDemoMode({ ZIKI_DEMO: "true" })).toBe(true);
    expect(isDemoMode({ ZIKI_DEMO: " TRUE " })).toBe(true);
    expect(isDemoMode({ ZIKI_DEMO: "1" })).toBe(false);
    expect(isDemoMode({})).toBe(false);
  });

  it("makes weather public in the demo or when switched on", () => {
    expect(isWeatherPublic({ ZIKI_DEMO: "true" })).toBe(true);
    expect(isWeatherPublic({ WEATHER_PUBLIC: "true" })).toBe(true);
    expect(isWeatherPublic({})).toBe(false);
  });
});
