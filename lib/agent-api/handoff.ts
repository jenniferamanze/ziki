import { prisma } from "@/lib/prisma";
import { writeInbox } from "@/lib/agent-api/inbox";
import { audit } from "@/lib/agents/audit";
import type { AgentContext } from "@/lib/agents/require-agent";
import type { Prisma } from "@prisma/client";

/** A person hands an item to their agent. Delivered to the agent's inbox. */
export async function createHandOff({
  agentId,
  openedById,
  itemType,
  itemId,
  itemTitle,
  request,
}: {
  agentId: string;
  openedById: string;
  itemType: "points" | "assigned_issue";
  itemId: string;
  itemTitle: string;
  request: string;
}) {
  const handOff = await prisma.handOff.create({
    data: {
      agentId,
      openedById,
      itemType,
      itemId,
      itemTitle,
      request,
    },
    select: { id: true, agentId: true, status: true, createdAt: true },
  });

  const tenant = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { tenantId: true },
  });
  if (!tenant) throw new Error("Agent not found.");

  await prisma.$transaction(async (tx) => {
    const event = await tx.agentEvent.create({
      data: {
        tenantId: tenant.tenantId,
        type: "handoff.offered",
        actorAgentId: null,
        payload: {
          handOffId: handOff.id,
          agentId,
          openedById,
          itemType,
          itemId,
          itemTitle,
          request,
        },
      },
    });
    await writeInbox(tx, {
      id: event.id,
      tenantId: event.tenantId,
      type: "handoff.offered",
      actorAgentId: null,
      payload: event.payload as Prisma.InputJsonObject,
    });
    await audit(
      { agentId, tenantId: "" },
      "handoff.offered",
      `handoff:${handOff.id}`,
      { handOffId: handOff.id, agentId, openedById, itemType, itemId, itemTitle, request },
      { db: tx },
    );
  });

  return handOff;
}

/** The agent reports progress on a hand-off. */
export async function updateHandOffProgress(
  agent: AgentContext,
  handOffId: string,
  progressNote: string,
  status: "accepted" | "in_progress" | "completed" | "released",
) {
  const handOff = await prisma.handOff.findUnique({
    where: { id: handOffId },
    select: { id: true, agentId: true, status: true },
  });
  if (!handOff) throw new Error("Hand-off not found.");
  if (handOff.agentId !== agent.agentId) throw new Error("Not your hand-off.");

  const updated = await prisma.handOff.update({
    where: { id: handOffId },
    data: { progressNote, status },
    select: { id: true, status: true, progressNote: true, updatedAt: true },
  });

  const tenant = await prisma.agent.findUnique({
    where: { id: agent.agentId },
    select: { tenantId: true },
  });
  if (!tenant) throw new Error("Agent not found.");

  await prisma.$transaction(async (tx) => {
    const event = await tx.agentEvent.create({
      data: {
        tenantId: tenant.tenantId,
        type: "handoff.progress",
        actorAgentId: agent.agentId,
        payload: {
          handOffId,
          status,
          progressNote,
        },
      },
    });
    await writeInbox(tx, {
      id: event.id,
      tenantId: event.tenantId,
      type: "handoff.progress",
      actorAgentId: agent.agentId,
      payload: event.payload as Prisma.InputJsonObject,
    });
    await audit(
      { agentId: agent.agentId, tenantId: "" },
      "handoff.progress",
      `handoff:${handOffId}`,
      { handOffId, status, progressNote },
      { db: tx },
    );
  });

  return updated;
}

/** Open hand-offs for an agent, newest first. */
export async function listOpenHandOffs(agentId: string) {
  return prisma.handOff.findMany({
    where: { agentId, status: { not: "released" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, request: true, itemType: true, itemTitle: true, status: true,
      progressNote: true, createdAt: true, updatedAt: true,
    },
  });
}

/** Hand-offs opened by a person, newest first. */
export async function listHandOffsOpenedBy(userId: string) {
  return prisma.handOff.findMany({
    where: { openedById: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, agentId: true, itemType: true, itemId: true, itemTitle: true,
      request: true, status: true, progressNote: true, createdAt: true, updatedAt: true,
      agent: { select: { id: true, name: true } },
    },
  });
}
