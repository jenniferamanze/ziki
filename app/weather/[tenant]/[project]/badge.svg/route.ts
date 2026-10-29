import { prisma } from "@/lib/prisma";
import { isWeatherPublic } from "@/lib/demo-mode";
import { findWeatherProject, loadForecast } from "@/lib/weather/load";
import { badgeSvg } from "@/lib/weather/badge";

export const dynamic = "force-dynamic";

/** README badge: "Ziki weather | Mostly sunny · 31°" (#weather). */
export async function GET(_request: Request, { params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project: projectSlug } = await params;
  const project = isWeatherPublic() ? await findWeatherProject(prisma, tenant, projectSlug) : null;
  const text = project ? (await loadForecast(prisma, project)).badge : "unavailable";
  return new Response(badgeSvg(text), {
    status: project ? 200 : 404,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}
