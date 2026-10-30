import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAgent: vi.fn(), budget: vi.fn(), audit: vi.fn(), update: vi.fn() }));
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
vi.mock("@/lib/agent-api/handoff", async (original) => ({
  ...(await original<typeof import("@/lib/agent-api/handoff")>()),
  updateHandOffProgress: mocks.update,
}));

import { HandOffError } from "@/lib/agent-api/handoff";
import { POST } from "./route";

const caller = { agentId: "a1", name: "Claude", ownerId: "jen", tenantId: "t1", level: "observer" as const, burst: false, keyId: "k" };
const context = { params: Promise.resolve({ id: "h1" }) };
const request = (body: unknown) => new NextRequest("http://localhost/api/v1/handoffs/h1/progress", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

describe("POST /api/v1/handoffs/{id}/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAgent.mockResolvedValue(caller);
    mocks.budget.mockResolvedValue({ allowed: true, limit: 60, remaining: 59, resetSeconds: 60, retryAfterSeconds: 0 });
  });

  it("records the agent's progress, charged as a write", async () => {
    const updatedAt = new Date("2026-10-30T10:00:00Z");
    mocks.update.mockResolvedValue({ id: "h1", status: "in_progress", progressNote: "Reading logs", updatedAt });
    const response = await POST(request({ status: "in_progress", progressNote: "Reading logs" }), context);
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(caller, "h1", { status: "in_progress", progressNote: "Reading logs" });
    expect(mocks.budget).toHaveBeenCalledWith(expect.anything(), "write");
    expect(await response.json()).toEqual({ handOff: { id: "h1", status: "in_progress", progressNote: "Reading logs", updatedAt: updatedAt.toISOString() } });
  });

  it("rejects an unknown status or an empty note", async () => {
    expect((await POST(request({ status: "done", progressNote: "x" }), context)).status).toBe(400);
    expect((await POST(request({ status: "in_progress", progressNote: " " }), context)).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("passes on not-found and already-closed answers", async () => {
    mocks.update.mockRejectedValueOnce(new HandOffError("Hand-off not found.", 404));
    expect((await POST(request({ status: "in_progress", progressNote: "x" }), context)).status).toBe(404);
    mocks.update.mockRejectedValueOnce(new HandOffError("This hand-off is already completed.", 409));
    expect((await POST(request({ status: "in_progress", progressNote: "x" }), context)).status).toBe(409);
  });
});
