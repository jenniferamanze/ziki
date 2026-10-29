import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "@/components/weather/weather.css";
import { prisma } from "@/lib/prisma";
import { isWeatherPublic } from "@/lib/demo-mode";
import { requireUser } from "@/lib/auth-helpers";
import { findWeatherProject, loadForecast, weatherPath, type WeatherProject } from "@/lib/weather/load";
import { WeatherSky } from "@/components/weather/weather-sky";
import { WeatherBulletin, WeatherDiary, WeatherTomorrow } from "@/components/weather/weather-panels";

export const dynamic = "force-dynamic";

type Params = { tenant: string; project: string };

/** Public when switched on (and always in the demo); otherwise members only. */
async function visibleProject(params: Params): Promise<WeatherProject> {
  const project = await findWeatherProject(prisma, params.tenant, params.project);
  if (!project) notFound();
  if (!isWeatherPublic()) {
    const user = await requireUser();
    const member = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: project.tenantId, userId: user.id } },
      select: { id: true },
    });
    if (!member) notFound();
  }
  return project;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const project = await findWeatherProject(prisma, (await params).tenant, (await params).project);
  if (!project) return { title: "Ziki weather" };
  const forecast = await loadForecast(prisma, project);
  return {
    title: `${project.name} weather`,
    description: `${forecast.conditionLabel}, ${forecast.temperature}°. ${forecast.headline}`,
  };
}

export default async function WeatherPage({ params }: { params: Promise<Params> }) {
  const project = await visibleProject(await params);
  const forecast = await loadForecast(prisma, project);
  const path = weatherPath(project);
  const badgeMarkdown = `[![Ziki weather](https://ziki.dev${path}/badge.svg)](https://ziki.dev${path})`;

  return (
    <div className="min-h-screen bg-zk-bg text-zk-text">
      <header className="flex min-h-[60px] flex-wrap items-center gap-4 border-b border-zk-border bg-zk-surface px-6 sm:px-8">
        <Link href="/dashboard" className="flex items-center gap-2.5 text-lg font-extrabold text-zk-text">
          <span aria-hidden="true" className="flex size-[30px] items-center justify-center rounded-lg bg-zk-accent text-base text-white">Z</span>
          Ziki weather
        </Link>
        <span className="flex-1" />
        <span className="text-[13px] text-zk-muted">{path}</span>
      </header>

      <main className="mx-auto flex max-w-[1120px] flex-col gap-5 px-4 pt-7 pb-16 sm:px-6">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px] font-bold text-zk-muted">
              {project.name} · {forecast.dateLabel} · {forecast.editionTime}
            </span>
            <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.02em]">{forecast.headline}</h1>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-extrabold tracking-[-0.03em]">{forecast.temperature}°</span>
            <span className="text-sm font-semibold text-zk-text2">{forecast.temperatureWord}</span>
          </div>
        </div>

        <WeatherSky forecast={forecast} />

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          <WeatherBulletin forecast={forecast} />
          <WeatherTomorrow forecast={forecast} />
          <WeatherDiary forecast={forecast} shareHref={path} />
        </div>

        <section aria-labelledby="zw-share" className="flex flex-col gap-3 rounded-[20px] border border-dashed border-zk-border p-5">
          <h2 id="zw-share" className="text-base font-extrabold">Show the forecast in your README</h2>
          <div className="flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- an SVG badge, as it appears on GitHub */}
            <img src={`${path}/badge.svg`} alt={`Ziki weather: ${forecast.badge}`} height={20} />
          </div>
          <code className="block overflow-x-auto rounded-xl bg-zk-text px-4 py-3 font-mono text-xs leading-relaxed text-zk-tint">{badgeMarkdown}</code>
          <p className="text-sm leading-relaxed text-zk-text2">
            Every reading is a real Ziki number in weather words: merges are sunshine, new reports are rain, agent activity is wind, and issues waiting more than two days are clouds. Jenie writes a new bulletin at midnight, noon and 5pm.
          </p>
        </section>
      </main>
    </div>
  );
}
