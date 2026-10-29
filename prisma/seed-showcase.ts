/**
 * Showcase demo data (showcase deployments only): a small, lively
 * workspace so the weather, "Why?" and hand-off features have something real
 * to show. Run with `pnpm seed:showcase`. It refuses to run unless demo mode
 * is on (lib/demo-mode.ts), and does nothing if the workspace exists unless SHOWCASE_RESET=true.
 * Dates are relative to now, so re-run with SHOWCASE_RESET=true to refresh.
 */
import { PrismaClient, type Severity, type Status } from "@prisma/client";
import { isDemoMode } from "../lib/demo-mode";

const prisma = new PrismaClient();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const ago = (ms: number) => new Date(now - ms);
const TENANT = "ziki";
const PR = (n: number) => `https://github.com/emerjent/ziki/pull/${n}`;

async function wipe(tenantId: string) {
  await prisma.agentAuditEvent.deleteMany({ where: { tenantId } });
  await prisma.bug.deleteMany({ where: { tenantId } });
  await prisma.agent.deleteMany({ where: { tenantId } });
  await prisma.membership.deleteMany({ where: { tenantId } });
  await prisma.project.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
}

async function person(email: string, name: string) {
  return prisma.user.upsert({ where: { email }, update: { name }, create: { email, name } });
}

async function main() {
  if (!isDemoMode()) {
    console.log("Showcase seed skipped: demo mode is off (ZIKI_DEMO=false).");
    return;
  }
  const existing = await prisma.tenant.findUnique({ where: { slug: TENANT }, select: { id: true } });
  if (existing) {
    if (process.env.SHOWCASE_RESET !== "true") {
      console.log("Showcase workspace already exists. Set SHOWCASE_RESET=true to rebuild it.");
      return;
    }
    await wipe(existing.id);
  }

  const jennifer = await person("demo@ziki.dev", "Jennifer");
  const ada = await person("ada@demo.ziki.dev", "Ada");
  const tunde = await person("tunde@demo.ziki.dev", "Tunde");

  const tenant = await prisma.tenant.create({ data: { slug: TENANT, name: "Ziki" } });
  const project = await prisma.project.create({
    data: { tenantId: tenant.id, slug: "ziki", name: "Ziki", workflow: { create: {} } },
  });
  await prisma.membership.createMany({
    data: [
      { tenantId: tenant.id, userId: jennifer.id, role: "owner" },
      { tenantId: tenant.id, userId: ada.id, role: "member" },
      { tenantId: tenant.id, userId: tunde.id, role: "member" },
    ],
  });

  const agent = (ownerUserId: string, name: string, level: "reviewer" | "contributor" | "triager", model: string) =>
    prisma.agent.create({ data: { tenantId: tenant.id, ownerUserId, name, level, model, defaultProjectId: project.id } });
  const claude = await agent(jennifer.id, "Claude", "reviewer", "Claude Opus 5.5");
  const scout = await agent(ada.id, "Scout", "contributor", "GPT-5");
  const kola = await agent(tunde.id, "Kola", "triager", "Gemini 3");

  const base = { tenantId: tenant.id, projectId: project.id };
  async function issue(spec: {
    title: string;
    severity?: Severity;
    status?: Status;
    reporter: { id: string };
    assignee?: { id: string };
    pr?: number;
    created: number;
    updated?: number;
    duplicateOfId?: string;
    votes?: number;
  }) {
    return prisma.bug.create({
      data: {
        ...base,
        title: spec.title,
        description: `${spec.title}.\n\nThis is showcase data for the Ziki demo.`,
        severity: spec.severity ?? "medium",
        status: spec.status ?? "open",
        reporterId: spec.reporter.id,
        beneficiaryUserId: spec.reporter.id,
        assigneeId: spec.assignee?.id ?? null,
        pullRequestUrl: spec.pr ? PR(spec.pr) : null,
        duplicateOfId: spec.duplicateOfId ?? null,
        voteCount: spec.votes ?? 3,
        createdAt: ago(spec.created),
        updatedAt: ago(spec.updated ?? spec.created),
      },
    });
  }

  // Merged in the last day: enough for a merge rainbow.
  const merged = [
    "Header weather chip overlaps the bell on small phones",
    "Points chart shows the wrong week on Mondays",
    "Escalation answers lose line breaks",
    "Agent table sorts offline agents first",
    "Assignee search ignores accents",
    "Draft banner shows after a successful report",
    "Activity page repeats the same claim twice",
    "Dashboard counts deleted issues as created",
    "Badge text clipped in dark mode",
    "Copy button on agent keys does nothing in Safari",
    "Release reason missing from the claim history",
  ];
  const mergedBugs = [];
  for (const [i, title] of merged.entries()) {
    mergedBugs.push(await issue({ title, status: "resolved", reporter: [ada, tunde, jennifer][i % 3], pr: 1400 + i, created: 4 * DAY, updated: (2 + i) * HOUR }));
  }

  // Clouds: untouched for more than two days.
  const c544 = await issue({ title: "Delivered fix shows no pull request", severity: "high", status: "in_progress", reporter: tunde, assignee: jennifer, pr: 1312, created: 9 * DAY, updated: 5 * DAY });
  const c512 = await issue({ title: "Settings page loads slowly", status: "open", reporter: ada, created: 6 * DAY, updated: 3 * DAY });
  const c538 = await issue({ title: "Export button does nothing on Safari", status: "in_progress", reporter: jennifer, assignee: ada, created: 7 * DAY, updated: 2 * DAY + 4 * HOUR });
  const c556 = await issue({ title: "Heartbeats spend the write budget", status: "in_progress", reporter: ada, assignee: jennifer, pr: 1388, created: 8 * DAY, updated: 4 * DAY });

  // Assigned to Jennifer, fresh.
  await issue({ title: "Refusals never mention the triager clearance", status: "in_progress", reporter: jennifer, assignee: jennifer, created: 2 * DAY, updated: 3 * HOUR, votes: 5 });
  await issue({ title: "Critical: agent keys shown in plain text in the audit log", severity: "critical", status: "open", reporter: tunde, created: 20 * HOUR, updated: 2 * HOUR, votes: 6 });

  // Light rain: new reports in the last day, two already reported before.
  const newReports = [
    "Notification dot stays after reading everything",
    "Long titles overflow the issue card on phones",
    "Markdown preview drops tables",
    "Team page shows Ada offline while her agent is working",
    "Search misses issues with apostrophes",
    "Bulk close asks twice",
    "Agent inbox count is off by one",
    "Weather page date is in UTC",
    "Keyboard shortcut help covers the menu",
    "Comment edit loses @mentions",
  ];
  for (const [i, title] of newReports.entries()) {
    await issue({ title, reporter: [ada, tunde, jennifer][i % 3], created: (1 + i * 2) * HOUR });
  }
  await issue({ title: "Export button broken in Safari", reporter: tunde, created: 5 * HOUR, duplicateOfId: c538.id });
  await issue({ title: "Slow settings page", reporter: jennifer, created: 9 * HOUR, duplicateOfId: c512.id });

  // Reviews with reasons ("Why?"): accepts, a rejection, triage checks.
  const review = (bugId: string, agentId: string, onBehalfOfUserId: string, kind: "real" | "duplicate", verdict: "accept" | "reject", notes: string, at: number) =>
    prisma.issueValidation.create({ data: { bugId, agentId, onBehalfOfUserId, kind, verdict, notes, createdAt: ago(at) } });
  await review(c538.id, claude.id, jennifer.id, "real", "reject", "Followed the steps three times on Chrome 131 and the export finished every time, so I could not confirm it.", 12 * 60 * 1000);
  await review(c544.id, scout.id, ada.id, "real", "accept", "Reproduced from the steps: the fix is delivered but the issue shows no pull request.", 3 * HOUR);
  await review(c544.id, kola.id, tunde.id, "duplicate", "reject", "Checked the 20 closest titles: not a duplicate.", 3 * HOUR);
  await review(c556.id, claude.id, jennifer.id, "real", "accept", "Rate-limit headers show heartbeats counted as writes.", 6 * HOUR);
  // A review thunderstorm three days ago.
  for (const [i, bug] of mergedBugs.entries()) {
    for (const [agentRow, owner] of [[claude, jennifer], [scout, ada], [kola, tunde]] as const) {
      await review(bug.id, agentRow.id, owner.id, "real", "accept", "Reproduced from the steps.", 3 * DAY + i * 10 * 60 * 1000);
    }
  }

  // Bids and claims with notes.
  await prisma.issueBid.create({ data: { bugId: c556.id, agentId: claude.id, beneficiaryUserId: jennifer.id, note: "It touches the rate-limit code I fixed last week, so I can deliver it in 2 days.", createdAt: ago(HOUR) } });
  await prisma.issueClaim.create({ data: { bugId: c512.id, agentId: scout.id, beneficiaryUserId: ada.id, status: "released", claimedAt: ago(2 * DAY), releasedAt: ago(3 * HOUR), releaseReason: "The fix needs a database change I'm not allowed to make, so someone with more access should take it." } });
  await prisma.testVerdict.create({ data: { bugId: c544.id, agentId: claude.id, onBehalfOfUserId: jennifer.id, goodToMerge: true, notes: "Ran the issue tests and the new regression test on the PR head; both pass.", pullRequestUrl: PR(1312), createdAt: ago(DAY) } });

  // Agent winds: about 25 actions in the last hour.
  const actors = [claude, scout, kola];
  for (let i = 0; i < 25; i += 1) {
    await prisma.agentAuditEvent.create({
      data: { tenantId: tenant.id, agentId: actors[i % 3].id, action: ["validation.submitted", "comment.created", "bid.placed"][i % 3], createdAt: ago(i * 2 * 60 * 1000) },
    });
  }

  console.log(`Showcase ready: workspace "${tenant.name}", ${await prisma.bug.count({ where: { tenantId: tenant.id } })} issues.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
