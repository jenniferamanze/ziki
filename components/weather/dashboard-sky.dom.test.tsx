// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/(app)/dashboard/actions", () => ({ createHandOffAction: mocks.create }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { DashboardSky } from "./dashboard-sky";
import { CHECK_WEATHER_EVENT } from "@/lib/handoff/drag";

const clouds = [
  { id: "b544", number: 544, title: "Delivered fix shows no pull request", waitingLabel: "5 days", note: "Waiting on a review." },
  { id: "b512", number: 512, title: "Settings page loads slowly", waitingLabel: "3 days", note: "No pull request yet." },
];
const agents = [{ id: "a1", name: "Claude" }, { id: "a2", name: "Nova" }];

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("the dashboard sky", () => {
  it("draws each stuck issue as a cloud, titled on hover", () => {
    render(<DashboardSky clouds={clouds} rainbow={false} merges={3} agents={agents} />);
    const cloud = screen.getByRole("button", { name: "Stuck issue #544 Delivered fix shows no pull request, waiting 5 days" });
    expect(screen.queryByText("Delivered fix shows no pull request")).not.toBeInTheDocument();
    fireEvent.mouseEnter(cloud);
    expect(screen.getByText("Delivered fix shows no pull request")).toBeInTheDocument();
  });

  it("shows every title when the header chip checks the weather", () => {
    render(<DashboardSky clouds={clouds} rainbow={false} merges={3} agents={agents} />);
    act(() => { window.dispatchEvent(new CustomEvent(CHECK_WEATHER_EVENT)); });
    expect(screen.getByText("Settings page loads slowly")).toBeInTheDocument();
  });

  it("hands a cloud to an agent, which lifts it away", async () => {
    mocks.create.mockResolvedValue({ ok: true, agentName: "Nova" });
    render(<DashboardSky clouds={clouds} rainbow={false} merges={3} agents={agents} />);
    fireEvent.click(screen.getByRole("button", { name: /Stuck issue #512/ }));
    fireEvent.click(screen.getByRole("button", { name: "Give to Nova" }));
    expect(screen.getByRole("dialog", { name: "Hand off #512 Settings page loads slowly" })).toHaveTextContent("Ask Nova about");
    fireEvent.click(screen.getByRole("button", { name: "Investigate and draft a fix plan" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith({ agentId: "a2", itemType: "issue", itemId: "b512", request: "Investigate and draft a fix plan" });
  });

  it("brings out the rainbow with the day's merges", () => {
    render(<DashboardSky clouds={[]} rainbow merges={11} agents={agents} />);
    expect(screen.getByText("+11 merges")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Merge rainbow: 11 merges in the last day" }));
    expect(screen.getByRole("status")).toHaveTextContent("11 merges in the last day");
  });

  it("has no rainbow on an ordinary day", () => {
    render(<DashboardSky clouds={clouds} rainbow={false} merges={3} agents={agents} />);
    expect(screen.queryByRole("button", { name: /Merge rainbow/ })).not.toBeInTheDocument();
  });
});

describe("a stuck issue gets picked up", () => {
  it("bursts its cloud into sunshine, then lets it go", async () => {
    const { rerender } = render(<DashboardSky clouds={clouds} rainbow={false} merges={3} agents={agents} />);
    rerender(<DashboardSky clouds={[clouds[1]!]} rainbow={false} merges={3} agents={agents} />);
    const bursting = screen.getByRole("button", { name: /Stuck issue #544/ });
    expect(bursting).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole("button", { name: /Stuck issue #544/ })).not.toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByRole("button", { name: /Stuck issue #512/ })).toBeInTheDocument();
  });
});
