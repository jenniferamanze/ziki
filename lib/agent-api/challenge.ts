import { prisma } from "@/lib/prisma";
import { writeInbox } from "@/lib/agent-api/inbox";
import { audit } from "@/lib/agents/audit";
import type { AgentContext } from "@/lib/agents/require-agent";
import type { Prisma } from "@prisma/client";

/** A person challenges an agent's action ("I disagree"). Delivered to the
 * agent's inbox; the agent must answer before the action stops showing as
 * "challenged". */
export async function createChallenge({
  agentId,
  bugId,
  actionType,
  actionId,
  reason,
  openedById,
}: {
  agentId: string;
  bugId: string;
  actionType: "validation" | "bid" | "test_verdict" | "claim_release";
  actionId: string;
  reason: string;
  openedById: string;
}) {
  const challenge = await prisma.agentChallenge.create({
    data: {
      agentId,
      bugId,
      actionType,
      actionId,
      reason,
      openedById,
    },
    select: { id: true, agentId: true, bugId: true, createdAt: true },
  });

  // Publish an event and write an inbox item so the agent sees it.
  await prisma.$transaction(async (tx) => {
    const event = await tx.agentEvent.create({
      data: {
        tenantId: (await prisma.agent.findUnique({
          where: { id: agentId },
          select: { tenantId: true },
        }))!.tenantId,
        type: "challenge.opened",
        actorAgentId: null,
        bugId,
        payload: {
          challengeId: challenge.id,
          agentId,
          actionType,
          actionId,
          reason,
          openedById,
        },
      },
    });
    await writeInbox(tx, {
      id: event.id,
      tenantId: event.tenantId,
      type: "challenge.opened",
      actorAgentId: null,
      bugId,
      payload: event.payload as Prisma.InputJsonObject,
    });
    await audit(
      { agentId, tenantId: "" },
      "challenge.opened",
      `bug:${bugId}`,
      { challengeId: challenge.id, agentId, actionType, actionId, reason, openedById },
      { db: tx, bugId },
    );
  });

  return challenge;
}

/** The agent replies to a challenge, closing it as answered. */
export async function replyToChallenge(
  agent: AgentContext,
  challengeId: string,
  answer: string,
) {
  const challenge = await prisma.agentChallenge.findUnique({
    where: { id: challengeId },
    select: { id: true, agentId: true, bugId: true, status: true, openedById: true },
  });
  if (!challenge) throw new Error("Challenge not found.");
  if (challenge.agentId !== agent.agentId) throw new Error("Not your challenge.");
  if (challenge.status !== "open") throw new Error("Challenge already answered.");

  const updated = await prisma.agentChallenge.update({
    where: { id: challengeId },
    data: { status: "answered", answer, answeredAt: new Date() },
    select: { id: true, status: true, answer: true, answeredAt: true },
  });

  // Notify the person who opened the challenge.
  await prisma.$transaction(async (tx) => {
    const tenant = await tx.agent.findUnique({
      where: { id: agent.agentId },
      select: { tenantId: true },
    });
    const event = await tx.agentEvent.create({
      data: {
        tenantId: tenant!.tenantId,
        type: "challenge.answered",
        actorAgentId: agent.agentId,
        bugId: challenge.bugId,
        payload: { challengeId, answer, answeredAt: updated.answeredAt },
      },
    });
    await writeInbox(tx, {
      id: event.id,
      tenantId: event.tenantId,
      type: "challenge.answered",
      actorAgentId: agent.agentId,
      bugId: challenge.bugId,
      payload: event.payload as Prisma.InputJsonObject,
    });
  });

  return updated;
}

/** Open challenges for an agent, newest first. */
export async function listOpenChallenges(agentId: string) {
  return prisma.agentChallenge.findMany({
    where: { agentId, status: "open" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, reason: true, actionType: true, actionId: true, bugId: true,
      createdAt: true, openedBy: { select: { name: true, email: true } },
      bug: { select: { number: true, title: true } },
    },
  });
}
