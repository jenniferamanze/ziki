"use client";

import { useState } from "react";
import Link from "next/link";
import type { Forecast } from "@/lib/weather/forecast";

const SKIES: Record<Forecast["edition"], [string, string, string]> = {
  morning: ["#f2cdb4", "#f8d9c4", "#fdeedd"],
  afternoon: ["#a9c4ef", "#bcd3f7", "#e1ecff"],
  evening: ["#8d97cc", "#9aa4d6", "#c3c9ea"],
};
const SUN: Record<Forecast["edition"], { x: number; y: number; fill: string }> = {
  morning: { x: 230, y: 250, fill: "#ffb347" },
  afternoon: { x: 820, y: 110, fill: "#ffc94a" },
  evening: { x: 900, y: 270, fill: "#ff9a4d" },
};
const SPOTS = [
  { left: "8%", top: "10%", d: "34s" },
  { left: "36%", top: "28%", d: "41s" },
  { left: "58%", top: "6%", d: "29s" },
  { left: "72%", top: "40%", d: "37s" },
  { left: "20%", top: "44%", d: "45s" },
  { left: "46%", top: "52%", d: "31s" },
];
const WIND_SPEED = { calm: "6s", brisk: "3.2s", strong: "1.6s" } as const;

/**
 * The living sky (#weather). Each cloud is a real stuck issue: picking one
 * shows what it's waiting on and a link to help. When the issue moves, the
 * cloud is simply gone at the next look.
 */
export function WeatherSky({ forecast, issueBasePath = "/issues/" }: { forecast: Forecast; issueBasePath?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [rainOpen, setRainOpen] = useState(false);
  const brightness = forecast.cloudTotal === 0 ? 2 : forecast.cloudTotal <= 2 ? 1 : 0;
  const sky = SKIES[forecast.edition][brightness];
  const sun = SUN[forecast.edition];
  const drops = Array.from({ length: Math.min(forecast.rain.count, 24) }, (_, i) => ({
    d: `M${340 + i * 22} ${150 + (i % 3) * 10}v14`,
    delay: `${(i * 0.13).toFixed(2)}s`,
  }));
  const chosen = forecast.clouds.find((cloud) => cloud.id === selected) ?? null;

  return (
    <div className="space-y-4">
      <section aria-label="The sky over the project" className="zw-sky" style={{ backgroundColor: sky }}>
        <svg className="zw-layer" aria-hidden="true" viewBox="0 0 1072 380" preserveAspectRatio="xMidYMid slice">
          {forecast.rainbow ? (
            <g fill="none" strokeWidth="14" strokeLinecap="round" opacity="0.75">
              <path className="zw-rainbow" d="M520 380a260 260 0 0 1 520 0" stroke="#f26b5b" />
              <path className="zw-rainbow" d="M534 380a246 246 0 0 1 492 0" stroke="#f7b955" />
              <path className="zw-rainbow" d="M548 380a232 232 0 0 1 464 0" stroke="#6cc58c" />
              <path className="zw-rainbow" d="M562 380a218 218 0 0 1 436 0" stroke="#5aa0f2" />
            </g>
          ) : null}
          <circle className="zw-sun" cx={sun.x} cy={sun.y} r="62" fill={sun.fill} />
          {forecast.wind.level !== "calm" ? (
            <g stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.9" style={{ ["--zw-w" as string]: WIND_SPEED[forecast.wind.level] }}>
              <path className="zw-gust" d="M40 90h120" />
              <path className="zw-gust" d="M90 150h90" style={{ animationDelay: "1.1s" }} />
              <path className="zw-gust" d="M20 300h140" style={{ animationDelay: "2s" }} />
            </g>
          ) : null}
          <g stroke="#5aa0f2" strokeWidth="3" strokeLinecap="round">
            {drops.map((drop) => (
              <path key={drop.d} className="zw-drop" d={drop.d} style={{ animationDelay: drop.delay }} />
            ))}
          </g>
        </svg>

        {forecast.clouds.map((cloud, index) => {
          const spot = SPOTS[index % SPOTS.length];
          const on = cloud.id === selected;
          return (
            <button
              key={cloud.id}
              type="button"
              className="zw-cloud"
              aria-pressed={on}
              aria-label={`#${cloud.number}, ${cloud.title}, waiting ${cloud.waitingLabel}`}
              onClick={() => setSelected(on ? null : cloud.id)}
              style={{ left: spot.left, top: spot.top, ["--zw-d" as string]: spot.d }}
            >
              <svg aria-hidden="true" width="190" height="104" viewBox="0 0 190 104">
                <path
                  d="M38 98h112a34 34 0 0 0 0-68 46 46 0 0 0-86-6 36 36 0 0 0-26 74z"
                  fill={on ? "#ffffff" : "#f7f9fd"}
                  stroke={on ? "#1f5fd9" : "#d3dcef"}
                  strokeWidth="3"
                />
              </svg>
            </button>
          );
        })}

        <div className="absolute bottom-5 left-6 flex flex-wrap gap-2">
          <button type="button" className="zw-pill" aria-expanded={rainOpen} onClick={() => setRainOpen((open) => !open)}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1f5fd9" strokeWidth="2.4" strokeLinecap="round">
              <path d="M8 13v4M12 15v5M16 13v4M17.5 10a4.5 4.5 0 0 0-8.9-1A4 4 0 0 0 6 16" />
            </svg>
            {forecast.rain.label}
          </button>
          <span className="zw-pill">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1f5fd9" strokeWidth="2.4" strokeLinecap="round">
              <path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8" />
            </svg>
            {forecast.wind.label}
          </span>
        </div>
        {forecast.clouds.length > 0 ? (
          <span className="zw-pill absolute top-5 right-6 text-xs">Tap a cloud to see what&apos;s stuck</span>
        ) : null}
      </section>

      {chosen ? (
        <section aria-live="polite" className="zw-pop flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-zk-border bg-zk-surface px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-zk-text">
              #{chosen.number} · {chosen.title}
            </p>
            <p className="text-sm text-zk-text2">
              Waiting {chosen.waitingLabel}. {chosen.note}
            </p>
          </div>
          <Link
            href={`${issueBasePath}${chosen.id}`}
            className="inline-flex min-h-11 items-center rounded-full bg-zk-accent px-5 text-sm font-extrabold text-white hover:opacity-90"
          >
            Help clear it
          </Link>
        </section>
      ) : null}

      {rainOpen ? (
        <section aria-label="New reports" className="zw-pop rounded-2xl border border-zk-border bg-zk-surface px-5 py-4 text-sm">
          <p className="font-extrabold text-zk-text">{forecast.rain.count === 0 ? "No new reports since yesterday" : `${forecast.rain.count} new reports since yesterday`}</p>
          {forecast.rain.duplicates > 0 ? (
            <p className="text-zk-text2">{forecast.rain.duplicates} of them were already reported before.</p>
          ) : null}
          <Link href="/issues" className="mt-1 inline-flex min-h-8 items-center font-bold text-zk-accent hover:underline">
            Open the newest reports
          </Link>
        </section>
      ) : null}
    </div>
  );
}
