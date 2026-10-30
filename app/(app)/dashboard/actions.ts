"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { createHandOff, handOffSchema, HandOffError } from "@/lib/agent-api/handoff";

export type HandOffActionResult = { ok: true; agentName: string } | { ok: false; error: string };

/**
 * "Point and hand off": hand a dashboard item to one of your agents. Identity
 * and workspace come from the session; the agent must be your own.
 */
export async function createHandOffAction(input: unknown): Promise<HandOffActionResult> {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) return { ok: false, error: "Join a workspace to hand work to an agent." };
  const parsed = handOffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick an agent and one of the requests." };
  try {
    const handOff = await createHandOff({ id: user.id }, tenantId, parsed.data);
    revalidatePath("/dashboard");
    return { ok: true, agentName: handOff.agentName };
  } catch (error) {
    if (error instanceof HandOffError) return { ok: false, error: error.message };
    throw error;
  }
}
