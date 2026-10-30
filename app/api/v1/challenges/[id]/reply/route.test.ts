import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAgent: vi.fn(), budget: vi.fn(), audit: vi.fn(), reply: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/agents/require-agent", async (original) => ({
  ...(await original<typeof import("@/lib/agents/require-agent")>()),
  requireAgent: mocks.requireAgent,
}));
vi.mock("@/lib/agents/rate-budget", async (original) => ({
  ...(await original<typeof import("@/lib/agents/rate-budget")>()),
  consumeAgentBudget: mocks.budget,
}));
vi.mock("@/lib/agents/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/why/feedback", async (original) => ({
  ...(await original<typeof import("@/lib/why/feedback")>()),
  replyToChallenge: mocks.reply,
}));

import { WhyError } from "@/lib/why/feedback";
import { POST } from "./route";

const caller = { agentId: "a1", name: "Claude", ownerId: "jen", tenantId: "t1", level: "observer" as const, burst: false, keyId: "k" };
const context = { params: Promise.resolve({ id: "f1" }) };
const request = (body: unknown) => new NextRequest("http://localhost/api/v1/challenges/f1/reply", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

describe("POST /api/v1/challenges/{id}/reply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAgent.mockResolvedValue(caller);
    mocks.budget.mockResolvedValue({ allowed: true, limit: 60, remaining: 59, resetSeconds: 60, retryAfterSeconds: 0 });
  });

  it("answers the agent's own challenge, charged as a write", async () => {
    const repliedAt = new Date("2026-10-30T10:00:00Z");
    mocks.reply.mockResolvedValue({ id: "f1", reply: "You're right.", repliedAt, auditEventId: "e1" });
    const response = await POST(request({ reply: "You're right." }), context);
    expect(response.status).toBe(200);
    expect(mocks.reply).toHaveBeenCalledWith(caller, "f1", "You're right.");
    expect(mocks.budget).toHaveBeenCalledWith(expect.anything(), "write");
    expect(await response.json()).toEqual({ challenge: { id: "f1", reply: "You're right.", repliedAt: repliedAt.toISOString() } });
  });

  it("needs an answer", async () => {
    const response = await POST(request({ reply: "  " }), context);
    expect(response.status).toBe(400);
    expect(mocks.reply).not.toHaveBeenCalled();
  });

  it("is 404 for a challenge that isn't this agent's", async () => {
    mocks.reply.mockRejectedValue(new WhyError("Challenge not found.", 404));
    const response = await POST(request({ reply: "Hi" }), context);
    expect(response.status).toBe(404);
  });
});
