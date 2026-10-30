import Link from "next/link";
import { newIssueHref } from "@/lib/reported-from";
import { currentWeatherFor } from "@/lib/weather/current";
import { WeatherCard } from "@/components/weather/weather-card";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { bugInTenant, currentTenantIdFor } from "@/lib/tenant-context";
import {
  EMPTY_OVERVIEW,
  loadOwnAgents,
  loadWorkspaceOverview,
  RESOLVED_STATUSES,
  type WorkspaceOverview,
} from "@/lib/dashboard-overview";
import {
  DashboardAgents,
  type DashboardAgentView,
} from "@/components/dashboard-agents";
import { OverviewStatCards, type OverviewStat } from "@/components/overview/stat-cards";
import {
  AssignedIssuesTable,
  type OverviewAssignedIssue,
} from "@/components/overview/assigned-issues-table";
import { PointsChart } from "@/components/overview/points-chart";
import {
  loadPointHistory,
  pointsThisWeek,
  type PointHistoryEntry,
} from "@/lib/points/history";
import { formatPoints, TARGET_POINTS } from "@/lib/points/rules";
import { prisma } from "@/lib/prisma";
import { openIssueStages } from "@/lib/issue-stage";
import { listOpenHandOffs } from "@/lib/agent-api/handoff";
import { handOffActivity, issueRequests, statRequests, STAT_KEYS } from "@/lib/handoff/presets";
import { HandOffTip } from "@/components/hand-off-tip";
import type { StatHandOff } from "@/components/overview/stat-cards";
import type { IssueHandOff } from "@/components/overview/assigned-issues-table";

export const metadata: Metadata = { title: "Dashboard" };

function firstName(name: string | null | undefined, email: string | null | undefined): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed.split(/\s+/)[0] ?? trimmed;
  const local = email?.split("@")[0]?.trim();
  return local || "there";
}

function buildStats(input: {
  overview: WorkspaceOverview;
  weekPoints: number;
  createdLast30: number;
  highPriorityAssigned: number;
  resolvedAssigned: number;
}): OverviewStat[] {
  const { overview, weekPoints, createdLast30, highPriorityAssigned, resolvedAssigned } = input;
  const toGo = Math.max(0, TARGET_POINTS - weekPoints);
  const assigned = overview.assignedToMe;
  const resolvedPct =
    assigned === 0 ? 0 : Math.min(100, Math.round((resolvedAssigned / assigned) * 100));

  return [
    {
      label: "Points",
      value: formatPoints(overview.points.points),
      href: "/workers",
      chip: weekPoints >= TARGET_POINTS ? "Goal met" : `${formatPoints(toGo)} to go`,
      chipTone: weekPoints >= TARGET_POINTS ? "ok" : "tint",
      note: "500 required this week",
    },
    {
      label: "Created by me",
      value: String(overview.reportedByMe),
      href: "/issues?mine=created",
      chip: createdLast30 > 0 ? `+${createdLast30}` : "0",
      chipTone: createdLast30 > 0 ? "ok" : "chip",
      note: "in the last 30 days",
    },
    {
      label: "Assigned to me",
      value: String(assigned),
      href: "/issues?mine=assigned",
      chip: String(highPriorityAssigned),
      chipTone: highPriorityAssigned > 0 ? "bad" : "chip",
      note: "high priority",
    },
    {
      label: "Resolved issues",
      value: String(resolvedAssigned),
      href: "/issues?mine=assigned&status=finished",
      chip: `${resolvedPct}%`,
      chipTone: "chip",
      note: "of issues assigned to me",
    },
  ];
}

async function loadAssignedIssues(
  userId: string,
  tenantId: string,
): Promise<OverviewAssignedIssue[]> {
  const where = {
    ...bugInTenant(tenantId),
    isDeleted: false,
    assigneeId: userId,
  };
  const bugs = await prisma.bug.findMany({
    where,
    orderBy: [{ voteCount: "desc" }, { createdAt: "desc" }],
    take: 25,
    select: {
      id: true,
      number: true,
      title: true,
      severity: true,
      status: true,
      voteCount: true,
      createdAt: true,
      type: { select: { name: true } },
      _count: { select: { comments: true } },
      votes: {
        where: { userId },
        select: { value: true },
        take: 1,
      },
    },
  });
  if (bugs.length === 0) return [];

  let stages = new Map<string, "reported" | "confirmed" | "ready">();
  try {
    stages = await openIssueStages(prisma, {
      id: { in: bugs.map((b) => b.id) },
      ...bugInTenant(tenantId),
    });
  } catch (error) {
    console.error("[dashboard] assigned issue stages failed", error);
  }

  return bugs.map((bug) => ({
    id: bug.id,
    number: bug.number,
    title: bug.title,
    severity: bug.severity,
    status: bug.status,
    voteCount: bug.voteCount,
    userVoted: (bug.votes[0]?.value ?? 0) === 1,
    typeName: bug.type?.name ?? null,
    commentCount: bug._count.comments,
    createdAt: bug.createdAt.toISOString(),
    stage: stages.get(bug.id) ?? null,
  }));
}

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();

  let tenantId: string | null = null;
  try {
    tenantId = await currentTenantIdFor(user.id);
  } catch (error) {
    console.error("[dashboard] tenant resolution failed", error);
  }

  let overview: WorkspaceOverview = EMPTY_OVERVIEW;
  try {
    overview = await loadWorkspaceOverview({ userId: user.id, tenantId });
  } catch (error) {
    console.error("[dashboard] overview queries failed", error);
  }

  let agentRows: Awaited<ReturnType<typeof loadOwnAgents>> = [];
  try {
    agentRows = await loadOwnAgents({ userId: user.id, tenantId });
  } catch (error) {
    console.error("[dashboard] agents query failed", error);
  }

  let historyEntries: PointHistoryEntry[] = [];
  let createdLast30 = 0;
  let highPriorityAssigned = 0;
  let resolvedAssigned = 0;
  let assignedIssues: OverviewAssignedIssue[] = [];

  if (tenantId) {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const base = { ...bugInTenant(tenantId), isDeleted: false as const };

    try {
      const [history, createdCount, highCount, resolvedCount, assigned] = await Promise.all([
        loadPointHistory(prisma, { tenantId, userId: user.id }),
        prisma.bug.count({
          where: { ...base, reporterId: user.id, createdAt: { gte: thirtyDaysAgo } },
        }),
        prisma.bug.count({
          where: {
            ...base,
            assigneeId: user.id,
            severity: { in: ["high", "critical"] },
            status: { in: ["open", "in_progress"] },
          },
        }),
        prisma.bug.count({
          where: {
            ...base,
            assigneeId: user.id,
            status: { in: [...RESOLVED_STATUSES] },
          },
        }),
        loadAssignedIssues(user.id, tenantId),
      ]);
      historyEntries = history;
      createdLast30 = createdCount;
      highPriorityAssigned = highCount;
      resolvedAssigned = resolvedCount;
      assignedIssues = assigned;
    } catch (error) {
      console.error("[dashboard] overview extras failed", error);
    }
  }

  // "Point and hand off": what is with an agent now, and what each item offers.
  let openHandOffs: Awaited<ReturnType<typeof listOpenHandOffs>> = [];
  if (tenantId) {
    try {
      openHandOffs = await listOpenHandOffs(user.id, tenantId);
    } catch (error) {
      console.error("[dashboard] hand-offs load failed", error);
    }
  }
  const activeFor = (itemType: string, itemId: string) => {
    const handOff = openHandOffs.find((row) => row.itemType === itemType && row.itemId === itemId);
    return handOff ? { agentName: handOff.agent.name, note: handOffActivity(handOff) } : null;
  };
  const pointsToGo = Math.max(0, TARGET_POINTS - pointsThisWeek(historyEntries, now));
  const handOffAgents = agentRows.map((agent) => ({ id: agent.id, name: agent.name }));
  const statHandOffs: Record<string, StatHandOff> = {};
  for (const [label, key] of Object.entries(STAT_KEYS)) {
    statHandOffs[label] = { itemId: key, requests: statRequests(key, { pointsToGo }), active: activeFor("stat", key) };
  }
  const issueHandOffs: Record<string, IssueHandOff> = {};
  for (const issue of assignedIssues) {
    issueHandOffs[issue.id] = { requests: issueRequests(), active: activeFor("issue", issue.id) };
  }
  const agentHandOffs = openHandOffs.map((row) => ({ agentId: row.agentId, activity: handOffActivity(row) }));

  const agents: DashboardAgentView[] = agentRows.map((agent) => ({
    ...agent,
    lastSeenAt: agent.lastSeenAt ? agent.lastSeenAt.toISOString() : null,
  }));

  const weekPoints = pointsThisWeek(historyEntries, now);
  const stats = buildStats({
    overview,
    weekPoints,
    createdLast30,
    highPriorityAssigned,
    resolvedAssigned,
  });

  const chartEntries = historyEntries.map((e) => ({
    createdAt: e.createdAt.toISOString(),
    points: e.points,
  }));

  const name = firstName(user.name, user.email);
  // #weather: one card; a lookup failure never blocks the dashboard.
  const weather = await currentWeatherFor(user.id).catch(() => null);

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-zk-text">
            Welcome back, {name}
          </h1>
          <p className="text-sm text-zk-muted">
            Issues, votes and your points for Ziki at a glance.
          </p>
        </div>
        <Link
          href={newIssueHref("/dashboard")}
          className="inline-flex h-[42px] items-center gap-2 rounded-full border border-zk-border bg-zk-surface px-5 text-sm font-semibold text-zk-text hover:bg-zk-chip"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New issue
        </Link>
      </div>

      <HandOffTip hasAgents={handOffAgents.length > 0} />

      <OverviewStatCards stats={stats} handOff={{ agents: handOffAgents, byLabel: statHandOffs }} />

      {weather ? <WeatherCard weather={weather} /> : null}

      <AssignedIssuesTable issues={assignedIssues} handOff={{ agents: handOffAgents, byIssue: issueHandOffs }} />

      <PointsChart entries={chartEntries} nowIso={now.toISOString()} />

      <DashboardAgents initial={agents} handOffs={agentHandOffs} />
    </div>
  );
}
