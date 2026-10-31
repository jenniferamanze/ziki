"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Condition } from "@/lib/weather/forecast";
import { WeatherIcon } from "@/components/weather/weather-icon";
import dynamic from "next/dynamic";
import type { HandOffAgent } from "@/components/hand-off-menu";
import { CHECK_WEATHER_EVENT, WEATHER_MOMENT_EVENT } from "@/lib/handoff/drag";
import type { WeatherMoment } from "@/lib/weather/moments";
import { issueRequests } from "@/lib/handoff/presets";
import "@/components/weather/weather.css";

// Loaded only when someone hands an issue over from the panel, so the header
// stays light on every page.
const HandOffMenu = dynamic(() => import("@/components/hand-off-menu").then((module) => module.HandOffMenu), { ssr: false });

type ChipWeather = {
  path: string;
  projectName: string;
  condition: Condition;
  conditionLabel: string;
  temperature: number;
  headline: string;
  clouds: { id: string; number: number; title: string; waitingLabel: string }[];
  cloudTotal: number;
  tomorrow: { note: string; cleared: number; target: number };
  agents: HandOffAgent[];
};

/**
 * "☀ 31°" beside the notifications bell (#weather). It floats a little where
 * it sits. Clicking it opens today's weather: the oldest stuck issues, each
 * with "Give to" one of your agents, and how close tomorrow is to sunny. On
 * the dashboard the drifting clouds also show their titles for a moment.
 */
export function WeatherChip() {
  const [weather, setWeather] = useState<ChipWeather | null>(null);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ cloud: ChipWeather["clouds"][number]; agentId: string; x: number; y: number } | null>(null);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const [warmer, setWarmer] = useState<{ key: number; degrees: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/weather/current", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { weather: ChipWeather | null } | null) => {
          if (alive && body?.weather) setWeather(body.weather);
        })
        .catch(() => {});
    void load();
    // Weather moments: something happened in the project. Reload, and when
    // it got warmer show the degrees rising out of the chip for a moment.
    const onMoment = (event: Event) => {
      const moment = (event as CustomEvent<WeatherMoment>).detail;
      if (moment?.kind === "warmer") setWarmer({ key: Date.now(), degrees: moment.degrees });
      void load();
    };
    window.addEventListener(WEATHER_MOMENT_EVENT, onMoment);
    return () => {
      alive = false;
      window.removeEventListener(WEATHER_MOMENT_EVENT, onMoment);
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
      {warmer ? (
        <span
          key={warmer.key}
          aria-hidden="true"
          onAnimationEnd={() => setWarmer(null)}
          className="zw-warm pointer-events-none absolute -top-3 right-2 z-10 text-sm font-extrabold text-amber-600"
        >
          +{warmer.degrees}°
        </span>
      ) : null}
      <button
        ref={button}
        data-weather-chip=""
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Today's weather: ${weather.conditionLabel}, ${weather.temperature} degrees`}
        onClick={() => {
          if (!open) window.dispatchEvent(new CustomEvent(CHECK_WEATHER_EVENT));
          setOpen((value) => !value);
        }}
        className={`zw-chip-bob inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-extrabold text-zk-text ${open ? "border-zk-accent bg-zk-tint" : "border-zk-border bg-zk-surface hover:bg-zk-chip"}`}
      >
        <WeatherIcon condition={weather.condition} />
        {weather.cloudTotal > 0 ? <span className="text-zk-muted">{weather.cloudTotal}</span> : null}
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
                <span className="text-xs font-extrabold tracking-[0.06em] text-zk-muted uppercase">Stuck issues</span>
                {weather.clouds.map((cloud) => (
                  <div key={cloud.id} className="flex flex-col gap-1.5 rounded-[10px] bg-zk-bg px-2.5 py-2 text-sm text-zk-text">
                    <span className="font-bold">#{cloud.number} {cloud.title}</span>
                    <span className="text-xs text-zk-muted">Waiting {cloud.waitingLabel}</span>
                    {weather.agents.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {weather.agents.map((agent) => (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              setMenu({ cloud, agentId: agent.id, x: Math.max(8, Math.min(rect.left, window.innerWidth - 304)), y: rect.bottom + 8 });
                            }}
                            className="min-h-8 rounded-full bg-zk-accent px-2.5 text-xs font-bold text-white hover:opacity-90"
                          >
                            Give to {agent.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5 text-xs font-semibold text-zk-text">
              <span>{weather.tomorrow.note}</span>
              <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-zk-chip">
                <span
                  className="block h-full rounded-full bg-amber-400 transition-[width] duration-500"
                  style={{ width: `${weather.tomorrow.target > 0 ? Math.round((weather.tomorrow.cleared / weather.tomorrow.target) * 100) : 100}%` }}
                />
              </span>
            </div>
            {menu ? (
              <HandOffMenu
                x={menu.x}
                y={menu.y}
                itemType="issue"
                itemId={menu.cloud.id}
                itemTitle={`#${menu.cloud.number} ${menu.cloud.title}`}
                requests={issueRequests()}
                agents={weather.agents}
                initialAgentId={menu.agentId}
                onDone={() => setWeather((value) => (value ? { ...value, clouds: value.clouds.filter((c) => c.id !== menu.cloud.id), cloudTotal: Math.max(0, value.cloudTotal - 1) } : value))}
                onClose={() => setMenu(null)}
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
