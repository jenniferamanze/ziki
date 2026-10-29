import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { currentWeatherFor } from "@/lib/weather/current";

export const dynamic = "force-dynamic";

/** Today's forecast for the header chip, loaded after the page so it never slows it (#weather). */
export async function GET() {
  const user = await requireUser();
  const weather = await currentWeatherFor(user.id);
  if (!weather) return NextResponse.json({ weather: null });
  const { forecast, path, projectName } = weather;
  return NextResponse.json(
    {
      weather: {
        path,
        projectName,
        condition: forecast.condition,
        conditionLabel: forecast.conditionLabel,
        temperature: forecast.temperature,
        headline: forecast.headline,
        clouds: forecast.clouds.slice(0, 2).map((c) => ({ id: c.id, number: c.number, waitingLabel: c.waitingLabel })),
        cloudTotal: forecast.cloudTotal,
      },
    },
    { headers: { "Cache-Control": "private, max-age=120" } },
  );
}
