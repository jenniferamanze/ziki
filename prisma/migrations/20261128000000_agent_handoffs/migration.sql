-- Point and hand off: people hand work to their agents; agents report progress.
CREATE TABLE "HandOff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemTitle" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offered',
    "progressNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HandOff_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE,
    CONSTRAINT "HandOff_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "HandOff_agentId_status_idx" ON "HandOff"("agentId", "status");
CREATE INDEX "HandOff_openedById_idx" ON "HandOff"("openedById");
CREATE INDEX "HandOff_status_idx" ON "HandOff"("status");
