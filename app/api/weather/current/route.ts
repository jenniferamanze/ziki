import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { currentWeatherFor } from "@/lib/weather/current";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { loadOwnAgents } from "@/lib/dashboard-overview";
import { listOpenHandOffs } from "@/lib/agent-api/handoff";
import { maybeDemoPulse } from "@/lib/demo/pulse";
import { isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

/** How many robots, and how many clouds, the chip's panel shows. */
const PANEL_AGENTS = 3;
const PANEL_CLOUDS = 3;

/**
 * Today's forecast for the header chip, loaded after the page so it never
 * slows it (#weather). The panel lists the oldest stuck issues no agent is on
 * yet, each with a "Give to" button for the person's agents.
 */
export async function GET() {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  // Showcase only: something happens in the demo project now and then, so the
  // dashboard's weather moments can be seen live.
  if (tenantId && isDemoMode()) await maybeDemoPulse(tenantId).catch(() => null);
  const weather = await currentWeatherFor(user.id);
  if (!weather) return NextResponse.json({ weather: null });
  const [agents, handOffs] = tenantId
    ? await Promise.all([
        loadOwnAgents({ userId: user.id, tenantId }).catch(() => []),
        listOpenHandOffs(user.id, tenantId).catch(() => []),
      ])
    : [[], []];
  const taken = new Set(handOffs.filter((row) => row.itemType === "issue").map((row) => row.itemId));
  const { forecast, path, projectName } = weather;
  const clouds = forecast.clouds.filter((cloud) => !taken.has(cloud.id));
  return NextResponse.json(
    {
      weather: {
        path,
        projectName,
        condition: forecast.condition,
        conditionLabel: forecast.conditionLabel,
        temperature: forecast.temperature,
        merges: forecast.merges,
        newReports: forecast.rain.count,
        headline: forecast.headline,
        clouds: clouds.slice(0, PANEL_CLOUDS).map((c) => ({ id: c.id, number: c.number, title: c.title, waitingLabel: c.waitingLabel })),
        cloudTotal: Math.max(0, forecast.cloudTotal - taken.size),
        tomorrow: { note: forecast.tomorrow.note, cleared: forecast.tomorrow.cleared, target: forecast.tomorrow.target },
        agents: agents.slice(0, PANEL_AGENTS).map((agent) => ({ id: agent.id, name: agent.name })),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
