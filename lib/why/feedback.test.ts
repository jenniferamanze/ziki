import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const tx = {
    agentActionFeedback: { upsert: vi.fn(), update: vi.fn() },
    agentInboxItem: { create: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
  };
  return {
    tx,
    prisma: {
      membership: { findUnique: vi.fn() },
      agentAuditEvent: { findFirst: vi.fn() },
      agentActionFeedback: { findFirst: vi.fn() },
      $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
    },
    expire: vi.fn(),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: db.prisma }));
vi.mock("@/lib/lookups", () => ({ expireUnreadCounts: db.expire }));

import { replyToChallenge, respondSchema, respondToAction, WhyError } from "./feedback";

const ada = { id: "ada", name: "Ada" };
const event = {
  id: "e1", action: "issue.validated", bugId: "b1",
  agent: { id: "a1", name: "Claude", ownerUserId: "jen", revokedAt: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.membership.findUnique.mockResolvedValue({ role: "owner" });
  db.prisma.agentAuditEvent.findFirst.mockResolvedValue(event);
  db.tx.agentActionFeedback.upsert.mockResolvedValue({ id: "f1" });
});

describe("answering why? (makes sense / I disagree)", () => {
  it("needs a reason to disagree", () => {
    expect(respondSchema.safeParse({ verdict: "disagree", body: " " }).success).toBe(false);
    expect(respondSchema.safeParse({ verdict: "makes_sense" }).success).toBe(true);
  });

  it("records makes sense without telling anyone", async () => {
    await respondToAction(ada, "t1", "e1", { verdict: "makes_sense" });
    expect(db.tx.agentActionFeedback.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { auditEventId_userId: { auditEventId: "e1", userId: "ada" } },
      create: expect.objectContaining({ verdict: "makes_sense", body: null, agentId: "a1", tenantId: "t1" }),
    }));
    expect(db.tx.agentInboxItem.create).not.toHaveBeenCalled();
    expect(db.tx.notification.create).not.toHaveBeenCalled();
  });

  it("sends a challenge to the agent's inbox and tells its owner", async () => {
    await respondToAction(ada, "t1", "e1", { verdict: "disagree", body: "It fails on Safari." });
    expect(db.tx.agentInboxItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      agentId: "a1", kind: "challenge", eventType: "action.challenged", bugId: "b1",
      payload: expect.objectContaining({ challengeId: "f1", auditEventId: "e1", body: "It fails on Safari.", by: "Ada" }),
    }) });
    expect(db.tx.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: "jen", kind: "agent_challenged", url: "/activity#why-e1",
    }) });
    expect(db.expire).toHaveBeenCalledWith(["jen"]);
  });

  it("does not notify the owner about their own challenge, nor deliver to a revoked agent", async () => {
    db.prisma.agentAuditEvent.findFirst.mockResolvedValue({ ...event, agent: { ...event.agent, revokedAt: new Date() } });
    await respondToAction({ id: "jen", name: "Jennifer" }, "t1", "e1", { verdict: "disagree", body: "Wrong issue." });
    expect(db.tx.agentInboxItem.create).not.toHaveBeenCalled();
    expect(db.tx.notification.create).not.toHaveBeenCalled();
  });

  it("only lets admins and the agent's owner answer, and only agent actions", async () => {
    db.prisma.membership.findUnique.mockResolvedValue({ role: "member" });
    await expect(respondToAction(ada, "t1", "e1", { verdict: "makes_sense" })).rejects.toBeInstanceOf(WhyError);
    db.prisma.membership.findUnique.mockResolvedValue(null);
    await expect(respondToAction(ada, "t1", "e1", { verdict: "makes_sense" })).rejects.toMatchObject({ status: 403 });
    db.prisma.membership.findUnique.mockResolvedValue({ role: "owner" });
    db.prisma.agentAuditEvent.findFirst.mockResolvedValue(null);
    await expect(respondToAction(ada, "t1", "e1", { verdict: "makes_sense" })).rejects.toMatchObject({ status: 404 });
    expect(db.prisma.agentAuditEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "e1", tenantId: "t1", actorUserId: null },
    }));
  });
});

describe("the agent answers a challenge", () => {
  const agent = { agentId: "a1", tenantId: "t1", name: "Claude", ownerId: "jen" };

  it("answers in the thread and tells the challenger and the owner", async () => {
    db.prisma.agentActionFeedback.findFirst.mockResolvedValue({ id: "f1", userId: "ada", auditEventId: "e1", auditEvent: { bugId: "b1" } });
    db.tx.agentActionFeedback.update.mockResolvedValue({ id: "f1", reply: "You're right.", repliedAt: new Date(), auditEventId: "e1" });
    const result = await replyToChallenge(agent, "f1", "You're right.");
    expect(result.reply).toBe("You're right.");
    expect(db.prisma.agentActionFeedback.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "f1", agentId: "a1", tenantId: "t1", verdict: "disagree" },
    }));
    expect(db.tx.notification.createMany).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ userId: "ada", kind: "agent_challenge_answered", url: "/activity#why-e1" }),
      expect.objectContaining({ userId: "jen" }),
    ] });
    expect(db.expire).toHaveBeenCalledWith(["ada", "jen"]);
  });

  it("is 404 for another agent's challenge", async () => {
    db.prisma.agentActionFeedback.findFirst.mockResolvedValue(null);
    await expect(replyToChallenge(agent, "f9", "Hi")).rejects.toMatchObject({ status: 404 });
  });
});
