import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { isWeatherPublic } from "@/lib/demo-mode";
import { findWeatherProject, loadForecast } from "@/lib/weather/load";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Today's Ziki weather forecast";

/** The share card when a weather link is posted in Slack, WhatsApp or X (#weather). */
export default async function WeatherShareCard({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project: projectSlug } = await params;
  const project = isWeatherPublic() ? await findWeatherProject(prisma, tenant, projectSlug) : null;
  const forecast = project ? await loadForecast(prisma, project) : null;
  const line = forecast ? `${forecast.conditionLabel}, ${forecast.temperature}°` : "Ziki weather";
  const sub = forecast ? forecast.headline : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#1f5fd9", color: "#ffffff", fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36, fontWeight: 800 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: "#ffffff", color: "#1f5fd9" }}>Z</div>
          Ziki weather
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
          <div style={{ fontSize: 30, color: "#dbe7ff" }}>{project ? `${project.name} · ${forecast!.dateLabel}` : ""}</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>{line}</div>
          <div style={{ fontSize: 32, color: "#e7f0ff" }}>{sub}</div>
        </div>
        <svg width="360" height="276" viewBox="0 0 300 230" style={{ position: "absolute", right: 60, bottom: 60 }}>
          <circle cx="168" cy="92" r="58" fill="#ffc94a" />
          <path d="M62 190h150a42 42 0 0 0 0-84 58 58 0 0 0-110-6 45 45 0 0 0-40 90z" fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
