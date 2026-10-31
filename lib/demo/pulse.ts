import "server-only";
import { prisma } from "@/lib/prisma";
import { DEMO_USER_EMAIL, isDemoMode } from "@/lib/demo-mode";

/**
 * Showcase only (ZIKI_DEMO): keeps the demo project alive while a reviewer
 * watches, so the dashboard's weather moments happen on their own. About
 * once every PULSE_MS, one thing happens, in turn: a teammate files a new
 * report (rain), an agent's fix is merged (rainbow), or an agent picks up the
 * oldest stuck issue (a cloud bursts into sunshine). Never runs outside the
 * demo, and does nothing while anything else in the project changed recently.
 */
export const PULSE_MS = 75_000;
export const PULSE_KINDS = ["report", "merge", "unstick"] as const;
export type PulseKind = (typeof PULSE_KINDS)[number];

const REPORTS = [
  "Search box loses focus after typing a filter",
  "Points chart shows yesterday twice",
  "Invite link expires a day early",
  "Dark mode makes the vote count hard to read",
  "Webhook retries skip the last delivery",
  "Agent key copy button copies a blank line",
];
const FIXES = [
  "Typo in the onboarding email",
  "Badge colours swapped on the issue page",
  "Tooltip clipped on small screens",
  "Duplicate label on the export menu",
];

/** Which pulse runs in a time slot: they take turns. */
export function pulseKindAt(now: number): PulseKind {
  return PULSE_KINDS[Math.floor(now / PULSE_MS) % PULSE_KINDS.length]!;
}

let lastPulse = 0;

export async function maybeDemoPulse(tenantId: string, now = new Date()): Promise<PulseKind | null> {
  if (!isDemoMode()) return null;
  if (now.getTime() - lastPulse < PULSE_MS) return null;
  const quietSince = new Date(now.getTime() - PULSE_MS);
  const recent = await prisma.bug.findFirst({ where: { tenantId, updatedAt: { gte: quietSince } }, select: { id: true } });
  if (recent) return null;
  lastPulse = now.getTime();

  const project = await prisma.project.findFirst({ where: { tenantId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const teammate = await prisma.membership.findFirst({
    where: { tenantId, user: { email: { not: DEMO_USER_EMAIL } } },
    select: { userId: true },
  });
  if (!project || !teammate) return null;
  const base = { tenantId, projectId: project.id, reporterId: teammate.userId, beneficiaryUserId: teammate.userId };
  const slot = Math.floor(now.getTime() / PULSE_MS);
  const kind = pulseKindAt(now.getTime());

  if (kind === "report") {
    const title = REPORTS[slot % REPORTS.length]!;
    await prisma.bug.create({ data: { ...base, title, description: `${title}.\n\nFiled during the Ziki showcase.`, severity: "low" } });
    return kind;
  }
  if (kind === "merge") {
    const title = FIXES[slot % FIXES.length]!;
    await prisma.bug.create({
      data: {
        ...base, title, description: `${title}.\n\nFixed and merged during the Ziki showcase.`, severity: "low", status: "resolved",
        pullRequestUrl: `https://github.com/emerjent/ziki/pull/${1400 + (slot % 500)}`,
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    });
    return kind;
  }
  // An agent picks up the oldest stuck issue nobody has handed over.
  const handedOver = await prisma.handOff.findMany({
    where: { itemType: "issue", status: { in: ["offered", "accepted", "in_progress"] }, agent: { tenantId } },
    select: { itemId: true },
  });
  const stuck = await prisma.bug.findFirst({
    where: {
      tenantId, isDeleted: false, status: { in: ["open", "in_progress"] },
      updatedAt: { lt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
      id: { notIn: handedOver.map((row) => row.itemId) },
    },
    orderBy: { updatedAt: "asc" },
    select: { id: true },
  });
  const helper = await prisma.agent.findFirst({
    where: { tenantId, revokedAt: null, owner: { email: { not: DEMO_USER_EMAIL } } },
    select: { id: true },
  });
  if (!stuck) return null;
  await prisma.bug.update({ where: { id: stuck.id }, data: { updatedAt: now } });
  if (helper) {
    await prisma.agentAuditEvent.create({
      data: { tenantId, agentId: helper.id, action: "comment.created", target: `bug:${stuck.id}`, bugId: stuck.id, payload: { request: false } },
    });
  }
  return kind;
}
