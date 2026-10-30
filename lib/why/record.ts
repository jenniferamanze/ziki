import type { Prisma } from "@prisma/client";
import { audit, type AuditAgent } from "@/lib/agents/audit";
import type { prisma } from "@/lib/prisma";

type Db = typeof prisma | Prisma.TransactionClient;

/**
 * Writes the domain audit row an agent action needs for "Why?" on the
 * Activity page (bids and releases only had a hidden request row before).
 * Runs inside the caller's transaction. Partial test doubles of the client
 * have no audit table; there is nothing to write then.
 */
export async function auditReasonedAction(
  db: Db,
  agent: AuditAgent,
  action: "issue.bid" | "claim.released",
  bugId: string,
  payload: Prisma.InputJsonObject,
): Promise<void> {
  if (typeof (db as { agentAuditEvent?: unknown }).agentAuditEvent === "undefined") return;
  await audit(agent, action, `bug:${bugId}`, payload, { bugId, db });
}
