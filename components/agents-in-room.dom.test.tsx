// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/(app)/dashboard/actions", () => ({ createHandOffAction: mocks.create }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { AgentsInRoom } from "./agents-in-room";
import { encodeDragItem, HANDOFF_MIME } from "@/lib/handoff/drag";

const agents = [
  { id: "a1", name: "Claude", doing: "Investigating #544 and drafting a fix plan", why: "You asked me to \"investigate and draft a fix plan\" on #544 Export, 25 minutes ago." },
  { id: "a2", name: "Nova", doing: null, why: null },
  { id: "a3", name: "Atlas", doing: null, why: null },
  { id: "a4", name: "Extra", doing: null, why: null },
];

function dropOn(target: HTMLElement, raw: string) {
  const data = new Map<string, string>([[HANDOFF_MIME, raw]]);
  const dataTransfer = { getData: (type: string) => data.get(type) ?? "", types: [HANDOFF_MIME], dropEffect: "none" };
  const event = createEvent.drop(target);
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  fireEvent(target, event);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("Agents in the room", () => {
  it("shows at most three robots, working or on standby", () => {
    render(<AgentsInRoom agents={agents} />);
    expect(screen.getByRole("button", { name: /Claude, working/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nova, on standby/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Atlas, on standby/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Extra/ })).not.toBeInTheDocument();
  });

  it("says what a robot is doing and why", () => {
    render(<AgentsInRoom agents={agents} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /Claude, working/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Claude: Investigating #544 and drafting a fix plan");
    expect(screen.getByRole("status")).toHaveTextContent("Why: You asked me to");
  });

  it("opens the three requests for the robot a card is dropped on", () => {
    render(<AgentsInRoom agents={agents} />);
    const item = { itemType: "stat" as const, itemId: "points", itemTitle: "Points", requests: ["Find me work worth 260 points", "Review my recent validations for anything I missed", "Check what is blocking my open claims"] };
    dropOn(screen.getByRole("button", { name: /Nova, on standby/ }), encodeDragItem(item));
    expect(screen.getByRole("dialog", { name: "Hand off Points" })).toHaveTextContent("Ask Nova about Points");
    expect(screen.getByRole("button", { name: "Find me work worth 260 points" })).toBeInTheDocument();
  });

  it("ignores anything else dropped on a robot", () => {
    render(<AgentsInRoom agents={agents} />);
    dropOn(screen.getByRole("button", { name: /Nova, on standby/ }), "not ours");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is absent when the person has no agents", () => {
    const { container } = render(<AgentsInRoom agents={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
