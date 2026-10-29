"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { Condition } from "@/lib/weather/forecast";
import { WeatherIcon } from "@/components/weather/weather-icon";
import "@/components/weather/weather.css";

type ChipWeather = {
  path: string;
  projectName: string;
  condition: Condition;
  conditionLabel: string;
  temperature: number;
  headline: string;
  clouds: { id: string; number: number; waitingLabel: string }[];
  cloudTotal: number;
};

/**
 * "☀ 31°" beside the notifications bell (#weather). Loads after the page,
 * opens a small panel with today's summary and a couple of clouds to clear.
 */
export function WeatherChip() {
  const [weather, setWeather] = useState<ChipWeather | null>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/weather/current")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { weather: ChipWeather | null } | null) => {
        if (alive && body?.weather) setWeather(body.weather);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!weather) return null;

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Today's weather: ${weather.conditionLabel}, ${weather.temperature} degrees`}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-extrabold text-zk-text ${open ? "border-zk-accent bg-zk-tint" : "border-zk-border bg-zk-surface hover:bg-zk-chip"}`}
      >
        <WeatherIcon condition={weather.condition} />
        {weather.temperature}°
      </button>
      {open ? (
        <section
          id={panelId}
          aria-label="Today's weather"
          className="zw-pop absolute top-12 right-0 z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-[18px] border border-zk-border bg-zk-surface shadow-[0_18px_48px_rgb(21_18_31/0.18)]"
        >
          <div className="flex h-24 items-center justify-center bg-[#cfe0fb]">
            <WeatherIcon condition={weather.condition} size={110} />
          </div>
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[28px] font-extrabold text-zk-text">{weather.temperature}°</span>
              <span className="font-extrabold text-zk-text">{weather.conditionLabel}</span>
            </div>
            <p className="text-sm leading-relaxed text-zk-text2">{weather.headline}</p>
            {weather.clouds.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-extrabold tracking-[0.06em] text-zk-muted uppercase">Clouds you could clear</span>
                {weather.clouds.map((cloud) => (
                  <Link
                    key={cloud.id}
                    href={`/issues/${cloud.id}`}
                    onClick={() => setOpen(false)}
                    className="flex justify-between gap-2.5 rounded-[10px] bg-zk-bg px-2.5 py-2 text-sm text-zk-text hover:bg-zk-chip"
                  >
                    <span>#{cloud.number} · waiting {cloud.waitingLabel}</span>
                    <span className="font-bold text-zk-accent">Help clear</span>
                  </Link>
                ))}
              </div>
            ) : null}
            <Link
              href={weather.path}
              onClick={() => setOpen(false)}
              className="inline-flex h-[42px] items-center justify-center rounded-full bg-zk-accent font-extrabold text-white hover:opacity-90"
            >
              Full forecast
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
