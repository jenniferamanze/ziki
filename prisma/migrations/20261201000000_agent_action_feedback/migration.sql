-- Replaces the earlier "Why?" draft (20261127000000_agent_challenges): its
-- table was never used for real data.
DROP TABLE IF EXISTS "AgentChallenge";

-- "Why?" on agent actions: a person's "makes sense" or challenge ("I disagree"),
-- and the agent's answer to it.
CREATE TABLE "AgentActionFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "auditEventId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "body" TEXT,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentActionFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentActionFeedback_auditEventId_userId_key" ON "AgentActionFeedback"("auditEventId", "userId");
CREATE INDEX "AgentActionFeedback_agentId_verdict_idx" ON "AgentActionFeedback"("agentId", "verdict");
CREATE INDEX "AgentActionFeedback_tenantId_createdAt_idx" ON "AgentActionFeedback"("tenantId", "createdAt");

ALTER TABLE "AgentActionFeedback" ADD CONSTRAINT "AgentActionFeedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentActionFeedback" ADD CONSTRAINT "AgentActionFeedback_auditEventId_fkey" FOREIGN KEY ("auditEventId") REFERENCES "AgentAuditEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentActionFeedback" ADD CONSTRAINT "AgentActionFeedback_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentActionFeedback" ADD CONSTRAINT "AgentActionFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
