import { prisma } from "@/lib/prisma";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { activeProjectIdFor } from "@/lib/project-context";
import { loadForecast, weatherPath, weatherProjectById } from "@/lib/weather/load";
import type { Forecast } from "@/lib/weather/forecast";

export type CurrentWeather = { forecast: Forecast; path: string; projectName: string };

/** The forecast for the person's active project, or null when there is none. */
export async function currentWeatherFor(userId: string): Promise<CurrentWeather | null> {
  const tenantId = await currentTenantIdFor(userId);
  if (!tenantId) return null;
  const projectId = await activeProjectIdFor(prisma, tenantId);
  if (!projectId) return null;
  const project = await weatherProjectById(prisma, projectId);
  if (!project || project.tenantId !== tenantId) return null;
  return { forecast: await loadForecast(prisma, project), path: weatherPath(project), projectName: project.name };
}
