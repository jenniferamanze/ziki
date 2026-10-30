import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const tx = {
    handOff: { updateMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    agentInboxItem: { create: vi.fn() },
    agentAuditEvent: { create: vi.fn() },
    notification: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      agent: { findFirst: vi.fn() },
      bug: { findFirst: vi.fn() },
      handOff: { findFirst: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
    },
    expire: vi.fn(),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: db.prisma }));
vi.mock("@/lib/lookups", () => ({ expireUnreadCounts: db.expire }));

import { createHandOff, handOffSchema, HandOffError, updateHandOffProgress } from "./handoff";

const jen = { id: "jen" };

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.agent.findFirst.mockResolvedValue({ id: "a1", name: "Claude", tenantId: "t1" });
  db.tx.handOff.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "h1", status: "offered", createdAt: new Date(), ...data }));
});

describe("handing an item to an agent", () => {
  it("only takes a known item type and a real request", () => {
    expect(handOffSchema.safeParse({ agentId: "a1", itemType: "stat", itemId: "points", request: "Find me work" }).success).toBe(true);
    expect(handOffSchema.safeParse({ agentId: "a1", itemType: "page", itemId: "x", request: "Find me work" }).success).toBe(false);
    expect(handOffSchema.safeParse({ agentId: "a1", itemType: "stat", itemId: "points", request: " " }).success).toBe(false);
  });

  it("hands an assigned issue to the person's own agent and puts it in the agent's inbox", async () => {
    db.prisma.bug.findFirst.mockResolvedValue({ id: "b1", number: 544, title: "Export broken" });
    const result = await createHandOff(jen, "t1", { agentId: "a1", itemType: "issue", itemId: "b1", request: "Investigate and draft a fix plan" });
    expect(db.prisma.agent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "a1", tenantId: "t1", ownerUserId: "jen", revokedAt: null },
    }));
    expect(result.agentName).toBe("Claude");
    expect(db.tx.handOff.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ itemTitle: "#544 Export broken", request: "Investigate and draft a fix plan" }),
    }));
    expect(db.tx.agentInboxItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      agentId: "a1", kind: "handoff", eventType: "handoff.offered", bugId: "b1",
      payload: expect.objectContaining({ handOffId: "h1", request: "Investigate and draft a fix plan", reportWith: "POST /api/v1/handoffs/h1/progress" }),
    }) });
    expect(db.tx.agentAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      tenantId: "t1", agentId: "a1", action: "handoff.offered", actorUserId: "jen",
    }) });
  });

  it("replaces an open hand-off on the same item", async () => {
    await createHandOff(jen, "t1", { agentId: "a1", itemType: "stat", itemId: "points", request: "Find me work worth 260 points" });
    expect(db.tx.handOff.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ openedById: "jen", itemType: "stat", itemId: "points" }),
      data: expect.objectContaining({ status: "released" }),
    }));
    expect(db.tx.handOff.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ itemTitle: "Points" }) }));
  });

  it("refuses someone else's agent, an unknown card and an issue from another workspace", async () => {
    db.prisma.agent.findFirst.mockResolvedValueOnce(null);
    await expect(createHandOff(jen, "t1", { agentId: "a9", itemType: "stat", itemId: "points", request: "Find work" }))
      .rejects.toMatchObject({ status: 404 });
    await expect(createHandOff(jen, "t1", { agentId: "a1", itemType: "stat", itemId: "salary", request: "Find work" }))
      .rejects.toBeInstanceOf(HandOffError);
    db.prisma.bug.findFirst.mockResolvedValue(null);
    await expect(createHandOff(jen, "t1", { agentId: "a1", itemType: "issue", itemId: "b9", request: "Find work" }))
      .rejects.toMatchObject({ status: 404 });
    expect(db.tx.handOff.create).not.toHaveBeenCalled();
  });
});

describe("the agent reports progress", () => {
  const agent = { agentId: "a1", tenantId: "t1", name: "Claude" };

  it("updates the note while it works, without notifying", async () => {
    db.prisma.handOff.findFirst.mockResolvedValue({ id: "h1", status: "offered", openedById: "jen", itemType: "issue", itemId: "b1", itemTitle: "#544 Export" });
    db.tx.handOff.update.mockResolvedValue({ id: "h1", status: "in_progress", progressNote: "Reading logs", updatedAt: new Date() });
    await updateHandOffProgress(agent, "h1", { status: "in_progress", progressNote: "Reading logs" });
    expect(db.prisma.handOff.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "h1", agentId: "a1", agent: { tenantId: "t1" } },
    }));
    expect(db.tx.notification.create).not.toHaveBeenCalled();
  });

  it("tells the person when it is done", async () => {
    db.prisma.handOff.findFirst.mockResolvedValue({ id: "h1", status: "in_progress", openedById: "jen", itemType: "stat", itemId: "points", itemTitle: "Points" });
    db.tx.handOff.update.mockResolvedValue({ id: "h1", status: "completed", progressNote: "Found 3 issues", updatedAt: new Date() });
    await updateHandOffProgress(agent, "h1", { status: "completed", progressNote: "Found 3 issues" });
    expect(db.tx.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "jen", kind: "handoff_completed", bugId: null }) });
    expect(db.expire).toHaveBeenCalledWith(["jen"]);
  });

  it("is 404 for another agent's hand-off and 409 once closed", async () => {
    db.prisma.handOff.findFirst.mockResolvedValueOnce(null);
    await expect(updateHandOffProgress(agent, "h9", { status: "in_progress", progressNote: "x" })).rejects.toMatchObject({ status: 404 });
    db.prisma.handOff.findFirst.mockResolvedValueOnce({ id: "h1", status: "completed", openedById: "jen", itemType: "stat", itemId: "points", itemTitle: "Points" });
    await expect(updateHandOffProgress(agent, "h1", { status: "in_progress", progressNote: "x" })).rejects.toMatchObject({ status: 409 });
  });
});
