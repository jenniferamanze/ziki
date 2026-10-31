"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WEATHER_MOMENT_EVENT } from "@/lib/handoff/drag";
import { momentLabel, momentsBetween, type WeatherMoment, type WeatherSnapshot } from "@/lib/weather/moments";
import "@/components/weather/weather.css";

const POLL_MS = 20_000;
const SHOW_MS = 4200;

type Shown = WeatherMoment & { key: number; left: string };

/**
 * Weather moments (#weather): when something happens in the project while
 * the dashboard is open, the sky reacts once. A merge draws a rainbow across
 * the sky with "+1 merge"; a new report falls as a raindrop that splashes on
 * the cards; a stuck issue someone picks up bursts into sunshine (the sky does
 * that) and the header chip warms up. Checks every 20 seconds while visible.
 */
export function WeatherMoments({ initial }: { initial: WeatherSnapshot }) {
  const router = useRouter();
  const last = useRef<WeatherSnapshot>(initial);
  const counter = useRef(0);
  const [shown, setShown] = useState<Shown[]>([]);

  useEffect(() => {
    let stopped = false;
    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/weather/current", { cache: "no-store" });
        const data = (await response.json()) as { weather: (WeatherSnapshot & Record<string, unknown>) | null };
        if (stopped || !data.weather) return;
        const next = { merges: data.weather.merges, newReports: data.weather.newReports, temperature: data.weather.temperature };
        const moments = momentsBetween(last.current, next);
        last.current = next;
        if (!moments.length) return;
        for (const moment of moments) window.dispatchEvent(new CustomEvent(WEATHER_MOMENT_EVENT, { detail: moment }));
        const added = moments
          .filter((moment) => moment.kind !== "warmer")
          .map((moment) => ({ ...moment, key: ++counter.current, left: `${20 + ((counter.current * 37) % 60)}%` }));
        if (added.length) {
          setShown((value) => [...value, ...added]);
          window.setTimeout(() => setShown((value) => value.filter((m) => !added.some((a) => a.key === m.key))), SHOW_MS);
        }
        router.refresh();
      } catch {
        // The weather is decoration: a failed check just waits for the next one.
      }
    }
    const timer = window.setInterval(check, POLL_MS);
    const first = window.setTimeout(check, 4000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, [router]);

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[360px] overflow-hidden">
      {shown.map((moment) =>
        moment.kind === "merge" ? (
          <div key={moment.key} className="zw-moment absolute top-1 left-1/2 -ml-[180px] w-[360px] text-center">
            <svg className="zw-moment-arc" width="360" height="150" viewBox="0 0 360 150" fill="none" aria-hidden="true">
              <path d="M10 148a170 136 0 0 1 340 0" stroke="#e86a5c" strokeWidth="8" />
              <path d="M22 148a158 124 0 0 1 316 0" stroke="#f2b23e" strokeWidth="8" />
              <path d="M34 148a146 112 0 0 1 292 0" stroke="#6cc070" strokeWidth="8" />
              <path d="M46 148a134 100 0 0 1 268 0" stroke="#4f8ff7" strokeWidth="8" />
            </svg>
            <span className="zw-moment-label absolute inset-x-0 top-[78px] text-lg font-extrabold text-zk-text">{momentLabel(moment)}</span>
          </div>
        ) : (
          <div key={moment.key} className="absolute top-0" style={{ left: moment.left }}>
            <span className="zw-drop-fall block h-[22px] w-[14px] rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-[#4f8ff7]" aria-hidden="true" />
            <span className="zw-splash absolute top-[300px] -left-[18px] block h-[12px] w-[50px] rounded-[50%] border-2 border-[#4f8ff7]" aria-hidden="true" />
            <span className="zw-moment-label absolute top-[268px] left-[-40px] w-[150px] text-center text-base font-extrabold text-zk-text">{momentLabel(moment)}</span>
          </div>
        ),
      )}
      <span className="sr-only">{shown.map((moment) => momentLabel(moment)).join(", ")}</span>
    </div>
  );
}
