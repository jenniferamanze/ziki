import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), tenant: vi.fn(), load: vi.fn(), enabled: vi.fn(), why: vi.fn() }));
vi.mock("@/lib/why/load", () => ({ loadWhy: mocks.why }));
vi.mock("@/components/why/why-panel", () => ({
  WhyPanel: ({ auditEventId, view }: { auditEventId: string; view: { why: string | null } }) => <div>why? {auditEventId} {view.why}</div>,
}));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/tenant-context", () => ({ currentTenantIdFor: mocks.tenant }));
vi.mock("@/lib/agent-center/queries", () => ({ loadAgentCenter: mocks.load }));
vi.mock("@/lib/feature-flags", () => ({ isAgentPlatformEnabled: mocks.enabled }));
vi.mock("@/components/local-time", () => ({ LocalTime: () => <time>Today</time> }));
vi.mock("@/components/issue-approval-banner", () => ({ IssueApprovalBanner: ({ approval }: { approval: { id: string } }) => <div>Pipeline controls {approval.id}</div> }));
vi.mock("@/app/(app)/escalations/escalation-controls", () => ({
  EscalationTypeBadge: ({ type }: { type: string }) => <span>{type}</span>,
  QuickResolveButtons: ({ escalationId }: { escalationId: string }) => <button>Respond {escalationId}</button>,
}));
vi.mock("@/lib/agent-questions", () => ({ parseEscalationBody: (body: string) => ({ type: "Blocker", cleanBody: body }) }));
import ActivityPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "u1" });
  mocks.tenant.mockResolvedValue("t1");
  mocks.enabled.mockReturnValue(true);
  const empty = { items: [], next: null };
  mocks.load.mockResolvedValue({ isAdmin: false, questions: empty, approvals: empty, work: empty, events: empty });
  mocks.why.mockResolvedValue(new Map());
});

it("authenticates before querying, including when the feature is disabled", async () => {
  mocks.requireUser.mockRejectedValue(new Error("Sign in"));
  mocks.enabled.mockReturnValue(false);
  await expect(ActivityPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("Sign in");
  expect(mocks.load).not.toHaveBeenCalled();
});

it("passes only session identity and current tenant to the query", async () => {
  await ActivityPage({ searchParams: Promise.resolve({ issue: "123" }) });
  expect(mocks.load).toHaveBeenCalledWith("u1", "t1", { issue: "123" });
});

it("renders the three sections and explains different decision semantics", async () => {
  const html = renderToStaticMarkup(await ActivityPage({ searchParams: Promise.resolve({}) }));
  for (const text of ["Needs Attention", "Work History", "Recent Activity", "do not grant pipeline approval", "not an assigned agent", "Claim state"]) expect(html).toContain(text);
  expect(html).toContain("Workspace owner or admin access is required");
});

it("handles members without a workspace without showing activity", async () => {
  mocks.load.mockResolvedValue(null);
  const html = renderToStaticMarkup(await ActivityPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("Join a workspace");
  expect(html).not.toContain("Pipeline controls");
});

it("renders issue/PR links and pipeline approvals without inventing an agent", async () => {
  mocks.load.mockResolvedValue({
    isAdmin: true, questions: { items: [], next: null }, work: { items: [], next: null }, events: { items: [], next: null },
    approvals: { items: [{ id: "approval1", stage: "before_offer", status: "pending", createdAt: new Date(), bug: { id: "bug1", number: 42, title: "Fix", pullRequestUrl: "https://github.com/org/repo/pull/1" } }], next: "older" },
  });
  const html = renderToStaticMarkup(await ActivityPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('/issues/bug1');
  expect(html).toContain('https://github.com/org/repo/pull/1');
  expect(html).toContain("Pipeline controls approval1");
  expect(html).toContain("approvals=older");
  expect(html).not.toContain("undefined");
});

it("shows claim deadlines, owner blockers and audit timestamps with issue links", async () => {
  const at = new Date("2026-10-27T12:00:00Z");
  const bug = { id: "b1", number: 9, title: "Login", status: "in_progress", pullRequestUrl: null };
  mocks.load.mockResolvedValue({
    isAdmin: false, questions: { items: [], next: null }, approvals: { items: [], next: null },
    work: { items: [{ id: "c1", createdAt: at, status: "active", agent: { name: "Ada's agent" }, bug, deliverBy: at, waitingOnOwnerSince: at, releasedAt: null, releaseReason: null, lastHeartbeatAt: at }], next: null },
    events: { items: [{ id: "e1", createdAt: at, action: "issue.claimed", agent: { name: "Ada's agent" }, bug, undoneAt: null }], next: null },
  });
  const html = renderToStaticMarkup(await ActivityPage({ searchParams: Promise.resolve({}) }));
  for (const text of ["Claim: active", "Issue: In progress", "Delivery deadline", "Blocked: waiting for owner guidance", "clocks are paused", "Last heartbeat", "issue.claimed", "/issues/b1", "<time>Today</time>"]) expect(html).toContain(text);
});

it("puts why? on agent actions and marks a challenged one (Why?)", async () => {
  const at = new Date("2026-10-27T12:00:00Z");
  const bug = { id: "b1", number: 9, title: "Login", status: "open", pullRequestUrl: null };
  mocks.load.mockResolvedValue({
    isAdmin: true, questions: { items: [], next: null }, approvals: { items: [], next: null }, work: { items: [], next: null },
    events: { items: [
      { id: "e1", createdAt: at, action: "issue.validated", agentId: "a1", actorUserId: null, agent: { name: "Claude" }, bug, undoneAt: null },
      { id: "e2", createdAt: at, action: "agent.level_changed", agentId: "a1", actorUserId: "u9", agent: { name: "Claude" }, bug: null, undoneAt: null },
    ], next: null },
  });
  mocks.why.mockResolvedValue(new Map([["e1", {
    why: "Could not reproduce on Chrome.", checked: "Three runs", myVerdict: null, state: "challenged",
    challenges: [{ id: "f1", byName: "Ada", mine: false, body: "It fails on Safari", reply: null, createdAt: at, repliedAt: null }],
    trust: { makesSense: 2, challenged: 1 },
  }]]));
  const html = renderToStaticMarkup(await ActivityPage({ searchParams: Promise.resolve({}) }));
  expect(mocks.why).toHaveBeenCalledWith("u1", "t1", [
    { id: "e1", agentId: "a1", action: "issue.validated", actorUserId: null },
    { id: "e2", agentId: "a1", action: "agent.level_changed", actorUserId: "u9" },
  ]);
  expect(html).toContain('id="why-e1"');
  expect(html).toContain("why? e1 Could not reproduce on Chrome.");
  expect(html).toContain("Challenged");
  expect(html).not.toContain("why? e2");
});
