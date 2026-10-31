// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { WeatherMoments } from "./weather-moments";
import { WEATHER_MOMENT_EVENT } from "@/lib/handoff/drag";

const initial = { merges: 11, newReports: 12, temperature: 31 };
function serve(weather: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ weather }) })));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("weather moments", () => {
  it("draws a rainbow for a merge and a raindrop for a new report, then refreshes", async () => {
    serve({ merges: 12, newReports: 13, temperature: 33 });
    const moments = vi.fn();
    window.addEventListener(WEATHER_MOMENT_EVENT, moments);
    render(<WeatherMoments initial={initial} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
    expect(screen.getAllByText("+1 merge").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+1 new report").length).toBeGreaterThan(0);
    expect(moments).toHaveBeenCalledTimes(3);
    expect(mocks.refresh).toHaveBeenCalled();
    window.removeEventListener(WEATHER_MOMENT_EVENT, moments);
  });

  it("stays quiet when nothing happened", async () => {
    serve(initial);
    render(<WeatherMoments initial={initial} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
    expect(screen.queryByText(/merge|report/)).not.toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("the showcase loop", () => {
  it("rains from the first second and draws a rainbow within a few", async () => {
    serve(initial);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    const { container } = render(<WeatherMoments initial={initial} showcase />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(container.querySelectorAll(".zw-drop-fall").length).toBeGreaterThan(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(container.querySelectorAll(".zw-moment-arc").length).toBe(1);
  });

  it("stays off outside the demo", async () => {
    serve(initial);
    const { container } = render(<WeatherMoments initial={initial} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(container.querySelectorAll(".zw-drop-fall").length).toBe(0);
  });
});
