import "server-only";
import { prisma } from "@/lib/prisma";
import { challengeState, explainAction, reasonRefs, type ChallengeState, type FeedbackVerdict } from "./explain";

/** One challenge ("I disagree") and the agent's answer, as the panel shows it. */
export type WhyChallenge = {
  id: string;
  byName: string;
  mine: boolean;
  body: string;
  reply: string | null;
  createdAt: Date;
  repliedAt: Date | null;
};

/** Everything the "why?" panel of one Activity row needs. */
export type WhyView = {
  why: string | null;
  checked: string | null;
  /** The viewer's own answer, if they gave one. */
  myVerdict: FeedbackVerdict | null;
  /** "challenged" while a disagreement waits for the agent's answer. */
  state: ChallengeState;
  challenges: WhyChallenge[];
  /** The agent's trust so far: reasons that made sense, and challenges. */
  trust: { makesSense: number; challenged: number };
};

type Row = { id: string; agentId: string; action: string; actorUserId: string | null };

/**
 * Reads the reasons, answers and trust counts for the Activity rows the viewer
 * can already see (the caller passes only those). Agent actions only: rows a
 * person did to an agent (an undo, a level change) have no "why?".
 */
export async function loadWhy(viewerUserId: string, tenantId: string, rows: Row[]): Promise<Map<string, WhyView>> {
  const agentRows = rows.filter((row) => !row.actorUserId);
  const views = new Map<string, WhyView>();
  if (!agentRows.length) return views;
  const ids = agentRows.map((row) => row.id);
  const agentIds = [...new Set(agentRows.map((row) => row.agentId))];

  const [audits, feedback, counts] = await Promise.all([
    prisma.agentAuditEvent.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, action: true, payload: true } }),
    prisma.agentActionFeedback.findMany({
      where: { tenantId, auditEventId: { in: ids } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, auditEventId: true, userId: true, verdict: true, body: true, reply: true,
        createdAt: true, repliedAt: true, user: { select: { name: true } },
      },
    }),
    prisma.agentActionFeedback.groupBy({
      by: ["agentId", "verdict"],
      where: { tenantId, agentId: { in: agentIds } },
      _count: { _all: true },
    }),
  ]);

  const refs = audits.map((audit) => ({ audit, ref: reasonRefs(audit.action, audit.payload) }));
  const pick = (key: "validationId" | "verdictId" | "bidId") =>
    refs.map(({ ref }) => ref[key]).filter((value): value is string => Boolean(value));
  const [validations, verdicts, bids] = await Promise.all([
    pick("validationId").length
      ? prisma.issueValidation.findMany({ where: { id: { in: pick("validationId") } }, select: { id: true, notes: true } })
      : Promise.resolve([]),
    pick("verdictId").length
      ? prisma.testVerdict.findMany({ where: { id: { in: pick("verdictId") } }, select: { id: true, notes: true } })
      : Promise.resolve([]),
    pick("bidId").length
      ? prisma.issueBid.findMany({ where: { id: { in: pick("bidId") } }, select: { id: true, note: true } })
      : Promise.resolve([]),
  ]);
  const notes = new Map<string, string | null>([
    ...validations.map((row) => [row.id, row.notes] as const),
    ...verdicts.map((row) => [row.id, row.notes] as const),
    ...bids.map((row) => [row.id, row.note] as const),
  ]);

  const trust = new Map<string, { makesSense: number; challenged: number }>();
  for (const row of counts) {
    const entry = trust.get(row.agentId) ?? { makesSense: 0, challenged: 0 };
    if (row.verdict === "makes_sense") entry.makesSense += row._count._all;
    if (row.verdict === "disagree") entry.challenged += row._count._all;
    trust.set(row.agentId, entry);
  }

  const agentOf = new Map(agentRows.map((row) => [row.id, row.agentId]));
  for (const { audit, ref } of refs) {
    const answers = feedback.filter((row) => row.auditEventId === audit.id);
    const mine = answers.find((row) => row.userId === viewerUserId);
    const explanation = explainAction({
      action: audit.action,
      payload: audit.payload,
      validationNotes: ref.validationId ? notes.get(ref.validationId) : null,
      verdictNotes: ref.verdictId ? notes.get(ref.verdictId) : null,
      bidNote: ref.bidId ? notes.get(ref.bidId) : null,
    });
    views.set(audit.id, {
      ...explanation,
      myVerdict: mine?.verdict === "makes_sense" || mine?.verdict === "disagree" ? mine.verdict : null,
      state: challengeState(answers),
      challenges: answers
        .filter((row) => row.verdict === "disagree" && row.body)
        .map((row) => ({
          id: row.id,
          byName: row.user.name,
          mine: row.userId === viewerUserId,
          body: row.body ?? "",
          reply: row.reply,
          createdAt: row.createdAt,
          repliedAt: row.repliedAt,
        })),
      trust: trust.get(agentOf.get(audit.id) ?? "") ?? { makesSense: 0, challenged: 0 },
    });
  }
  return views;
}
