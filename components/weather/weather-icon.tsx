import type { Condition } from "@/lib/weather/forecast";
import "@/components/weather/weather.css";

const RAYS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4;
  const x1 = 168 + Math.cos(angle) * 72;
  const y1 = 92 + Math.sin(angle) * 72;
  const x2 = 168 + Math.cos(angle) * 92;
  const y2 = 92 + Math.sin(angle) * 92;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
}).join("");

/**
 * Sun, sun-and-cloud, cloud or rain, in the forecast's own colours, and
 * alive: the sun glows and its rays turn slowly, clouds drift a little, rain
 * falls. Everything is still for reduced-motion settings.
 */
export function WeatherIcon({ condition, size = 22 }: { condition: Condition; size?: number }) {
  const cloud = "M62 190h150a42 42 0 0 0 0-84 58 58 0 0 0-110-6 45 45 0 0 0-40 90z";
  const sun = condition !== "cloudy";
  const rays = condition === "sunny" || condition === "mostly_sunny";
  return (
    <svg aria-hidden="true" width={size} height={Math.round(size * 0.77)} viewBox="0 0 300 230" overflow="visible">
      {rays ? <path className="zw-icon-rays" d={RAYS} stroke="#ffb020" strokeWidth="12" strokeLinecap="round" /> : null}
      {sun ? <circle className="zw-icon-sun" cx="168" cy="92" r="58" fill="#ffc94a" /> : null}
      {condition === "sunny" ? null : (
        <path className="zw-icon-cloud" d={cloud} fill="#ffffff" stroke="#c9d8f3" strokeWidth="10" />
      )}
      {condition === "showers" ? (
        <g stroke="#5aa0f2" strokeWidth="12" strokeLinecap="round">
          <path className="zw-icon-drop" d="M100 206v16" />
          <path className="zw-icon-drop zw-icon-drop-2" d="M140 206v16" />
          <path className="zw-icon-drop zw-icon-drop-3" d="M180 206v16" />
        </g>
      ) : null}
    </svg>
  );
}
