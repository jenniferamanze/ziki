import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHOWCASE_BUILD } from "@/lib/demo-mode";

/**
 * Webhook deliveries and platform sweeps must actually get scheduled (#583, #647).
 * The showcase build (demo/showcase) drops them: Vercel's free plan only allows
 * daily crons, and the demo needs neither.
 */
describe.skipIf(SHOWCASE_BUILD)("vercel.json cron (#583, #647)", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons?: { path: string; schedule: string }[];
  };

  it("schedules the webhook dispatcher once a day (Vercel hobby limit)", () => {
    const cron = config.crons?.find((entry) => entry.path === "/api/v1/webhooks/dispatch");
    expect(cron).toBeDefined();
    expect(cron!.schedule).toBe("0 0 * * *");
  });

  it("schedules the platform internal cron runner once a day (#647)", () => {
    const cron = config.crons?.find((entry) => entry.path === "/api/internal/cron");
    expect(cron).toBeDefined();
    expect(cron!.schedule).toBe("0 0 * * *");
  });
});
