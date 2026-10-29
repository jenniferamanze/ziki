"use server";

import { createHandOff, listHandOffsOpenedBy } from "@/lib/agent-api/handoff";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { requireUser } from "@/lib/auth-helpers";

/** Hand off an item to one of the user's agents. Returns the new hand-off. */
export async function createHandOffAction({
  agentId,
  itemType,
  itemId,
  itemTitle,
  request,
}: {
  agentId: string;
  itemType: "points" | "assigned_issue";
  itemId: string;
  itemTitle: string;
  request: string;
}) {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) throw new Error("No tenant.");

  return createHandOff({
    agentId,
    openedById: user.id,
    itemType,
    itemId,
    itemTitle,
    request,
  });
}

/** Hand-offs opened by the current user, newest first. */
export async function getHandOffsOpenedBy() {
  const user = await requireUser();
  return listHandOffsOpenedBy(user.id);
}
