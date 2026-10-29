import type { Condition } from "@/lib/weather/forecast";

/** Sun, sun-and-cloud, cloud or rain, in the forecast's own colours. */
export function WeatherIcon({ condition, size = 22 }: { condition: Condition; size?: number }) {
  const cloud = "M62 190h150a42 42 0 0 0 0-84 58 58 0 0 0-110-6 45 45 0 0 0-40 90z";
  return (
    <svg aria-hidden="true" width={size} height={Math.round(size * 0.77)} viewBox="0 0 300 230">
      {condition !== "cloudy" ? <circle cx="168" cy="92" r="58" fill="#ffc94a" /> : null}
      {condition === "sunny" ? null : <path d={cloud} fill="#ffffff" stroke="#c9d8f3" strokeWidth="10" />}
      {condition === "showers" ? (
        <path d="M100 214v14M140 214v14M180 214v14" stroke="#5aa0f2" strokeWidth="12" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}
