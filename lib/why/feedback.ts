import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isTenantAdminRole } from "@/lib/agents/membership";
import { expireUnreadCounts } from "@/lib/lookups";
import { agentActionLabel } from "@/lib/agent-audit/labels";
import { snippet } from "./explain";
import { WHY_CHALLENGE_MAX } from "./limits";

/**
 * Answers to "Why?" (Activity page). "Makes sense" counts towards the agent's
 * trust. "I disagree" is a challenge: it goes to the agent's inbox (kind
 * `challenge`), its owner is told, and the action shows as challenged until
 * the agent answers with `POST /api/v1/challenges/{id}/reply`.
 */

export const respondSchema = z.discriminatedUnion("verdict", [
  z.object({ verdict: z.literal("makes_sense") }),
  z.object({
    verdict: z.literal("disagree"),
    body: z.string().trim().min(3, "Say what it got wrong.").max(WHY_CHALLENGE_MAX),
  }),
]);
export type RespondInput = z.infer<typeof respondSchema>;

export const replySchema = z.object({
  reply: z.string().trim().min(1, "Send your answer.").max(WHY_CHALLENGE_MAX),
}).strict();

export class WhyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const activityLink = (auditEventId: string) => `/activity#why-${auditEventId}`;

/**
 * A person answers an agent action they can see on the Activity page: a
 * workspace owner or admin sees every agent, anyone else their own agents.
 */
export async function respondToAction(
  person: { id: string; name: string },
  tenantId: string,
  auditEventId: string,
  input: RespondInput,
): Promise<{ id: string; verdict: RespondInput["verdict"] }> {
  const member = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId: person.id } },
    select: { role: true },
  });
  if (!member) throw new WhyError("Join this workspace to answer its agents.", 403);
  const event = await prisma.agentAuditEvent.findFirst({
    where: { id: auditEventId, tenantId, actorUserId: null },
    select: {
      id: true, action: true, bugId: true,
      agent: { select: { id: true, name: true, ownerUserId: true, revokedAt: true } },
    },
  });
  const canSee = event && (isTenantAdminRole(member.role) || event.agent.ownerUserId === person.id);
  if (!event || !canSee) throw new WhyError("That action was not found.", 404);

  const disagree = input.verdict === "disagree";
  return prisma.$transaction(async (tx) => {
    const row = await tx.agentActionFeedback.upsert({
      where: { auditEventId_userId: { auditEventId, userId: person.id } },
      create: {
        tenantId, auditEventId, agentId: event.agent.id, userId: person.id,
        verdict: input.verdict, body: disagree ? input.body : null,
      },
      // A new answer replaces the old one; a new challenge waits for a new reply.
      update: { verdict: input.verdict, body: disagree ? input.body : null, reply: null, repliedAt: null },
      select: { id: true },
    });
    if (!disagree) return { id: row.id, verdict: input.verdict };

    if (!event.agent.revokedAt) {
      await tx.agentInboxItem.create({
        data: {
          agentId: event.agent.id,
          kind: "challenge",
          eventType: "action.challenged",
          bugId: event.bugId,
          payload: {
            challengeId: row.id,
            auditEventId,
            action: event.action,
            issueId: event.bugId,
            by: person.name,
            body: input.body,
            replyWith: `POST /api/v1/challenges/${row.id}/reply`,
          },
        },
      });
    }
    if (event.agent.ownerUserId !== person.id) {
      await tx.notification.create({
        data: {
          userId: event.agent.ownerUserId, tenantId, bugId: event.bugId,
          kind: "agent_challenged",
          title: `${person.name} disagreed with ${event.agent.name} (${agentActionLabel(event.action).toLowerCase()}): “${snippet(input.body)}”`,
          url: activityLink(auditEventId),
        },
      });
    }
    return { id: row.id, verdict: input.verdict };
  }).then((result) => {
    if (disagree && event.agent.ownerUserId !== person.id) expireUnreadCounts([event.agent.ownerUserId]);
    return result;
  });
}

/**
 * The challenged agent answers in the same thread. Only its own, open or
 * answered challenges; a new answer replaces the old one. The person who
 * challenged, and the agent's owner, are told.
 */
export async function replyToChallenge(
  agent: { agentId: string; tenantId: string; name: string; ownerId: string },
  challengeId: string,
  reply: string,
) {
  const challenge = await prisma.agentActionFeedback.findFirst({
    where: { id: challengeId, agentId: agent.agentId, tenantId: agent.tenantId, verdict: "disagree" },
    select: { id: true, userId: true, auditEventId: true, auditEvent: { select: { bugId: true } } },
  });
  if (!challenge) throw new WhyError("Challenge not found.", 404);
  const now = new Date();
  const recipients = [...new Set([challenge.userId, agent.ownerId])];
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.agentActionFeedback.update({
      where: { id: challenge.id },
      data: { reply, repliedAt: now },
      select: { id: true, reply: true, repliedAt: true, auditEventId: true },
    });
    await tx.notification.createMany({
      data: recipients.map((userId) => ({
        userId, tenantId: agent.tenantId, bugId: challenge.auditEvent.bugId,
        kind: "agent_challenge_answered",
        title: `${agent.name} answered the challenge: “${snippet(reply)}”`,
        url: activityLink(challenge.auditEventId),
      })),
    });
    return row;
  });
  expireUnreadCounts(recipients);
  return updated;
}
