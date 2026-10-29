import Link from "next/link";
import type { CurrentWeather } from "@/lib/weather/current";
import { WeatherIcon } from "@/components/weather/weather-icon";

/** One card on the dashboard: today's forecast and a way into it (#weather). */
export function WeatherCard({ weather }: { weather: CurrentWeather }) {
  const { forecast, path } = weather;
  return (
    <section aria-label="Today's weather" className="flex flex-wrap items-center gap-4 rounded-2xl border border-zk-border bg-zk-surface px-5 py-4">
      <WeatherIcon condition={forecast.condition} size={64} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-extrabold text-zk-text">
          {forecast.conditionLabel} · {forecast.temperature}°
        </span>
        <span className="text-sm text-zk-text2">{forecast.headline}</span>
      </div>
      <Link href={path} className="inline-flex min-h-10 items-center font-bold text-zk-accent hover:underline">
        Full forecast
      </Link>
    </section>
  );
}
