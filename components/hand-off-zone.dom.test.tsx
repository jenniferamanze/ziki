// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/(app)/dashboard/actions", () => ({ createHandOffAction: mocks.create }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { HandOffZone } from "./hand-off-zone";

const requests = ["Investigate and draft a fix plan", "Check it still happens on the latest build", "Ask the reporter for what's missing"];
function renderRow(onOpen = vi.fn()) {
  render(
    <ul>
      <HandOffZone as="li" itemType="issue" itemId="b1" itemTitle="#544 Export" requests={requests} agents={[{ id: "a1", name: "Claude" }]}>
        <button type="button" onClick={onOpen}>Export</button>
      </HandOffZone>
    </ul>,
  );
  return onOpen;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("Point and hand off", () => {
  it("leaves a normal click alone", () => {
    const onOpen = renderRow();
    fireEvent.click(screen.getByText("Export"));
    expect(onOpen).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens three requests on Alt+click, without following the link", () => {
    const onOpen = renderRow();
    fireEvent.click(screen.getByText("Export"), { altKey: true });
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Hand off #544 Export" })).toBeInTheDocument();
    for (const request of requests) expect(screen.getByRole("button", { name: request })).toBeInTheDocument();
  });

  it("opens with Alt+Enter and closes with Escape", () => {
    renderRow();
    fireEvent.keyDown(screen.getByText("Export"), { key: "Enter", altKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hands the item to the agent, then refreshes the dashboard", async () => {
    mocks.create.mockResolvedValue({ ok: true, agentName: "Claude" });
    renderRow();
    fireEvent.click(screen.getByText("Export"), { altKey: true });
    fireEvent.click(screen.getByRole("button", { name: requests[0] }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith({ agentId: "a1", itemType: "issue", itemId: "b1", request: requests[0] });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the menu open and shows why when it fails", async () => {
    mocks.create.mockResolvedValue({ ok: false, error: "Pick one of your own agents." });
    renderRow();
    fireEvent.click(screen.getByText("Export"), { altKey: true });
    fireEvent.click(screen.getByRole("button", { name: requests[1] }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pick one of your own agents.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
