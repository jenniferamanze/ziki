import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/agents/audit";
import { expireUnreadCounts } from "@/lib/lookups";
import type { AgentContext } from "@/lib/agents/require-agent";
import {
  HANDOFF_ITEM_TYPES, HANDOFF_REQUEST_MAX, isOpenHandOff, STAT_KEYS,
} from "@/lib/handoff/presets";

/**
 * "Point and hand off" (dashboard): a person points at an item (a stat card
 * or an "Assigned to me" row) and hands it to one of their own agents with a
 * request. The request goes to the agent's inbox (kind `handoff`); the agent
 * reports progress with `POST /api/v1/handoffs/{id}/progress`, which the
 * dashboard shows as "<agent> is on it" and in the Your agents table.
 */

export class HandOffError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export const handOffSchema = z.object({
  agentId: z.string().trim().min(1).max(191),
  itemType: z.enum(HANDOFF_ITEM_TYPES),
  itemId: z.string().trim().min(1).max(191),
  request: z.string().trim().min(3).max(HANDOFF_REQUEST_MAX),
}).strict();
export type HandOffInput = z.infer<typeof handOffSchema>;

export const PROGRESS_STATUSES = ["accepted", "in_progress", "completed", "released"] as const;
export const progressSchema = z.object({
  status: z.enum(PROGRESS_STATUSES),
  progressNote: z.string().trim().min(1).max(500),
}).strict();

const STAT_TITLES = new Map<string, string>(Object.entries(STAT_KEYS).map(([title, key]) => [key, title]));

/** A person hands an item to one of their own live agents in this workspace. */
export async function createHandOff(person: { id: string }, tenantId: string, input: HandOffInput) {
  const agent = await prisma.agent.findFirst({
    where: { id: input.agentId, tenantId, ownerUserId: person.id, revokedAt: null },
    select: { id: true, name: true, tenantId: true },
  });
  if (!agent) throw new HandOffError("Pick one of your own agents.", 404);

  let itemTitle: string;
  let bugId: string | null = null;
  if (input.itemType === "stat") {
    const title = STAT_TITLES.get(input.itemId);
    if (!title) throw new HandOffError("That item can't be handed off.", 400);
    itemTitle = title;
  } else {
    const bug = await prisma.bug.findFirst({
      where: { id: input.itemId, tenantId, isDeleted: false },
      select: { id: true, number: true, title: true },
    });
    if (!bug) throw new HandOffError("That issue was not found.", 404);
    itemTitle = `#${bug.number} ${bug.title}`;
    bugId = bug.id;
  }

  return prisma.$transaction(async (tx) => {
    // One open hand-off per item and person: a new request replaces the old one.
    await tx.handOff.updateMany({
      where: { openedById: person.id, itemType: input.itemType, itemId: input.itemId, status: { in: ["offered", "accepted", "in_progress"] } },
      data: { status: "released", progressNote: "Replaced by a new request." },
    });
    const handOff = await tx.handOff.create({
      data: { agentId: agent.id, openedById: person.id, itemType: input.itemType, itemId: input.itemId, itemTitle, request: input.request },
      select: { id: true, agentId: true, status: true, itemType: true, itemId: true, itemTitle: true, request: true, createdAt: true },
    });
    await tx.agentInboxItem.create({
      data: {
        agentId: agent.id,
        kind: "handoff",
        eventType: "handoff.offered",
        bugId,
        payload: {
          handOffId: handOff.id,
          itemType: input.itemType,
          itemId: input.itemId,
          itemTitle,
          issueId: bugId,
          request: input.request,
          reportWith: `POST /api/v1/handoffs/${handOff.id}/progress`,
        },
      },
    });
    await audit({ agentId: agent.id, tenantId }, "handoff.offered", `handoff:${handOff.id}`,
      { handOffId: handOff.id, itemType: input.itemType, itemId: input.itemId, request: input.request },
      { db: tx, bugId, actorUserId: person.id });
    return { ...handOff, agentName: agent.name };
  });
}

/**
 * The agent reports progress on work handed to it. Closed hand-offs
 * (completed or released) take no more reports. The person who handed it
 * over is told when the agent finishes or gives it back.
 */
export async function updateHandOffProgress(
  agent: Pick<AgentContext, "agentId" | "tenantId" | "name">,
  handOffId: string,
  input: z.infer<typeof progressSchema>,
) {
  const handOff = await prisma.handOff.findFirst({
    where: { id: handOffId, agentId: agent.agentId, agent: { tenantId: agent.tenantId } },
    select: { id: true, status: true, openedById: true, itemType: true, itemId: true, itemTitle: true },
  });
  if (!handOff) throw new HandOffError("Hand-off not found.", 404);
  if (!isOpenHandOff(handOff.status)) throw new HandOffError(`This hand-off is already ${handOff.status}.`, 409);

  const finished = input.status === "completed" || input.status === "released";
  const bugId = handOff.itemType === "issue" ? handOff.itemId : null;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.handOff.update({
      where: { id: handOff.id },
      data: { status: input.status, progressNote: input.progressNote },
      select: { id: true, status: true, progressNote: true, updatedAt: true },
    });
    await audit({ agentId: agent.agentId, tenantId: agent.tenantId }, "handoff.progress", `handoff:${handOff.id}`,
      { handOffId: handOff.id, status: input.status, progressNote: input.progressNote }, { db: tx, bugId });
    if (finished) {
      await tx.notification.create({
        data: {
          userId: handOff.openedById, tenantId: agent.tenantId, bugId,
          kind: input.status === "completed" ? "handoff_completed" : "handoff_released",
          title: `${agent.name} ${input.status === "completed" ? "finished" : "gave back"} “${handOff.itemTitle}”: ${input.progressNote}`,
          url: "/dashboard",
        },
      });
    }
    return row;
  });
  if (finished) expireUnreadCounts([handOff.openedById]);
  return updated;
}

/** This person's hand-offs in a workspace that are still with an agent. */
export async function listOpenHandOffs(userId: string, tenantId: string) {
  return prisma.handOff.findMany({
    where: { openedById: userId, status: { in: ["offered", "accepted", "in_progress"] }, agent: { tenantId, revokedAt: null } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, agentId: true, itemType: true, itemId: true, itemTitle: true, request: true,
      status: true, progressNote: true, agent: { select: { name: true } },
    },
  });
}
