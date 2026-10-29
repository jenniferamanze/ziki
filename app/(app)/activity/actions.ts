"use server";

import { prisma } from "@/lib/prisma";
import { createChallenge } from "@/lib/agent-api/challenge";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { requireUser } from "@/lib/auth-helpers";

/** Fetch the reason and what-I-checked for an agent action, so the "why?"
 * dialog can show it. Returns null when there is nothing to show. */
export async function getActionDetails({
  actionType,
  actionId,
}: {
  actionType: "validation" | "bid" | "test_verdict" | "claim_release";
  actionId: string;
}) {
  switch (actionType) {
    case "validation": {
      const row = await prisma.issueValidation.findUnique({
        where: { id: actionId },
        select: { notes: true, whatIchecked: true, verdict: true, kind: true },
      });
      return row
        ? {
            why: row.notes ?? null,
            whatIchecked: row.whatIchecked ?? null,
            label: `${row.kind} validation (${row.verdict})`,
          }
        : null;
    }
    case "bid": {
      const row = await prisma.issueBid.findUnique({
        where: { id: actionId },
        select: { note: true, whatIchecked: true },
      });
      return row
        ? { why: row.note ?? null, whatIchecked: row.whatIchecked ?? null, label: "Bid" }
        : null;
    }
    case "test_verdict": {
      const row = await prisma.testVerdict.findUnique({
        where: { id: actionId },
        select: { notes: true, whatIchecked: true, goodToMerge: true },
      });
      return row
        ? {
            why: row.notes ?? null,
            whatIchecked: row.whatIchecked ?? null,
            label: `Test verdict (${row.goodToMerge ? "good to merge" : "not good to merge"})`,
          }
        : null;
    }
    case "claim_release": {
      const row = await prisma.issueClaim.findUnique({
        where: { id: actionId },
        select: { releaseReason: true, whatIchecked: true, status: true, releasedAt: true },
      });
      return row && row.releasedAt
        ? {
            why: row.releaseReason ?? null,
            whatIchecked: row.whatIchecked ?? null,
            label: `Claim released (${row.status})`,
          }
        : null;
    }
  }
}

/** Open a challenge against an agent's action. The challenge is delivered
 * to the agent's inbox. */
export async function createChallengeAction({
  agentId,
  bugId,
  actionType,
  actionId,
  reason,
}: {
  agentId: string;
  bugId: string;
  actionType: "validation" | "bid" | "test_verdict" | "claim_release";
  actionId: string;
  reason: string;
}) {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) throw new Error("No tenant.");

  return createChallenge({
    agentId,
    bugId,
    actionType,
    actionId,
    reason,
    openedById: user.id,
  });
}

