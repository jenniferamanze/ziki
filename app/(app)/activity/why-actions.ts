"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { respondSchema, respondToAction, WhyError } from "@/lib/why/feedback";

export type WhyActionResult = { ok: true } | { ok: false; error: string };

/**
 * "Makes sense" or "I disagree" on an agent action (the "why?" panel on the
 * Activity page). Identity and workspace come from the session only.
 */
export async function answerWhyAction(auditEventId: string, input: unknown): Promise<WhyActionResult> {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) return { ok: false, error: "Join a workspace to answer its agents." };
  if (typeof auditEventId !== "string" || !auditEventId) return { ok: false, error: "That action was not found." };
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your answer and try again." };
  try {
    await respondToAction({ id: user.id, name: user.name?.trim() || "Someone" }, tenantId, auditEventId, parsed.data);
  } catch (error) {
    if (error instanceof WhyError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/activity");
  return { ok: true };
}
