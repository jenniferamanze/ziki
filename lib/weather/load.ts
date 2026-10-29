import type { PrismaClient } from "@prisma/client";
import {
  forecastFor,
  localDay,
  STUCK_AFTER_DAYS,
  type Forecast,
  type StuckIssue,
  type WeatherDay,
} from "@/lib/weather/forecast";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SHOWN_CLOUDS = 6;

/** Project time zone for the three daily editions; Lagos unless set. */
export function weatherTimeZone(env: Record<string, string | undefined> = process.env): string {
  const zone = env.WEATHER_TIME_ZONE?.trim() || "Africa/Lagos";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return zone;
  } catch {
    return "Africa/Lagos";
  }
}

export type WeatherProject = {
  id: string;
  name: string;
  slug: string;
  tenantId: string;
  tenantSlug: string;
};

const projectSelect = { id: true, name: true, slug: true, tenantId: true, tenant: { select: { slug: true } } } as const;

function toWeatherProject(row: { id: string; name: string; slug: string; tenantId: string; tenant: { slug: string } }): WeatherProject {
  return { id: row.id, name: row.name, slug: row.slug, tenantId: row.tenantId, tenantSlug: row.tenant.slug };
}

/** The project behind /weather/<workspace>/<project>. */
export async function findWeatherProject(db: PrismaClient, tenantSlug: string, projectSlug: string): Promise<WeatherProject | null> {
  const row = await db.project.findFirst({
    where: { slug: projectSlug, tenant: { slug: tenantSlug, archivedAt: null } },
    select: projectSelect,
  });
  return row ? toWeatherProject(row) : null;
}

export async function weatherProjectById(db: PrismaClient, projectId: string): Promise<WeatherProject | null> {
  const row = await db.project.findUnique({ where: { id: projectId }, select: projectSelect });
  return row ? toWeatherProject(row) : null;
}

export function weatherPath(project: Pick<WeatherProject, "tenantSlug" | "slug">): string {
  return `/weather/${encodeURIComponent(project.tenantSlug)}/${encodeURIComponent(project.slug)}`;
}

function startOfLocalDay(now: Date, timeZone: string): Date {
  // Walk back hour by hour until the local date changes: exact for any zone.
  const today = localDay(now, timeZone);
  let t = new Date(Math.floor(now.getTime() / HOUR) * HOUR);
  while (localDay(new Date(t.getTime() - HOUR), timeZone) === today) t = new Date(t.getTime() - HOUR);
  return t;
}

/** Everything the forecast needs, read from the existing tables. */
export async function loadForecast(
  db: PrismaClient,
  project: WeatherProject,
  now: Date = new Date(),
  timeZone: string = weatherTimeZone(),
): Promise<Forecast> {
  const live = { projectId: project.id, isDeleted: false };
  const dayAgo = new Date(now.getTime() - DAY);
  const stuckBefore = new Date(now.getTime() - STUCK_AFTER_DAYS * DAY);
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const todayStart = startOfLocalDay(now, timeZone);
  const stuckWhere = { ...live, status: { in: ["open", "in_progress"] as ("open" | "in_progress")[] }, updatedAt: { lt: stuckBefore } };

  const [merges24h, newReports24h, duplicateReports24h, agentActionsLastHour, criticalOpen, stuckRows, stuckTotal, clearedToday, resolvedWeek, reviewsWeek] =
    await Promise.all([
      db.bug.count({ where: { ...live, status: "resolved", pullRequestUrl: { not: null }, updatedAt: { gte: dayAgo } } }),
      db.bug.count({ where: { ...live, createdAt: { gte: dayAgo } } }),
      db.bug.count({ where: { ...live, createdAt: { gte: dayAgo }, duplicateOfId: { not: null } } }),
      db.agentAuditEvent.count({ where: { tenantId: project.tenantId, createdAt: { gte: new Date(now.getTime() - HOUR) } } }),
      db.bug.count({ where: { ...live, severity: "critical", status: { in: ["open", "in_progress"] } } }),
      db.bug.findMany({
        where: stuckWhere,
        orderBy: { updatedAt: "asc" },
        take: SHOWN_CLOUDS,
        select: { id: true, number: true, title: true, status: true, updatedAt: true, pullRequestUrl: true },
      }),
      db.bug.count({ where: stuckWhere }),
      db.bug.count({ where: { ...live, status: "resolved", updatedAt: { gte: todayStart }, createdAt: { lt: stuckBefore } } }),
      db.bug.findMany({
        where: { ...live, status: "resolved", pullRequestUrl: { not: null }, updatedAt: { gte: weekAgo } },
        select: { updatedAt: true },
      }),
      db.issueValidation.findMany({
        where: { bug: { projectId: project.id }, createdAt: { gte: weekAgo } },
        select: { createdAt: true },
      }),
    ]);

  const stuck: StuckIssue[] = stuckRows.map((row) => ({
    id: row.id,
    number: row.number,
    title: row.title,
    waitingDays: Math.max(STUCK_AFTER_DAYS, Math.floor((now.getTime() - row.updatedAt.getTime()) / DAY)),
    state: row.status === "open" ? "awaiting_review" : row.pullRequestUrl ? "pr_waiting" : "no_pr",
  }));

  const days = new Map<string, WeatherDay>();
  for (let i = 6; i >= 0; i -= 1) {
    const day = localDay(new Date(now.getTime() - i * DAY), timeZone);
    days.set(day, { day, merges: 0, reviews: 0 });
  }
  for (const row of resolvedWeek) {
    const bucket = days.get(localDay(row.updatedAt, timeZone));
    if (bucket) bucket.merges += 1;
  }
  for (const row of reviewsWeek) {
    const bucket = days.get(localDay(row.createdAt, timeZone));
    if (bucket) bucket.reviews += 1;
  }

  return forecastFor({
    now,
    timeZone,
    projectName: project.name,
    merges24h,
    newReports24h,
    duplicateReports24h,
    agentActionsLastHour,
    criticalOpen,
    stuck,
    stuckTotal,
    clearedToday,
    history: [...days.values()],
  });
}
