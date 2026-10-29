-- Agent challenges: a person challenges an agent's action ("I disagree"),
-- delivered to the agent's inbox; the agent must answer.
CREATE TABLE "AgentChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "answeredAt" TIMESTAMP(3),
    "openedById" TEXT NOT NULL,
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentChallenge_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE,
    CONSTRAINT "AgentChallenge_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE,
    CONSTRAINT "AgentChallenge_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "AgentChallenge_agentId_status_idx" ON "AgentChallenge"("agentId", "status");
CREATE INDEX "AgentChallenge_bugId_idx" ON "AgentChallenge"("bugId");
CREATE INDEX "AgentChallenge_status_idx" ON "AgentChallenge"("status");
