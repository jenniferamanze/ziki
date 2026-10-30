"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHandOffAction } from "@/app/(app)/dashboard/actions";
import type { HandOffItemType } from "@/lib/handoff/presets";

export type HandOffAgent = { id: string; name: string };

/** The small menu at the item: pick a request and the agent gets it in its inbox. */
export function HandOffMenu({
  x, y, itemType, itemId, itemTitle, requests, agents, onClose,
}: {
  x: number;
  y: number;
  itemType: HandOffItemType;
  itemId: string;
  itemTitle: string;
  requests: string[];
  agents: HandOffAgent[];
  onClose: () => void;
}) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const agentName = agents.find((agent) => agent.id === agentId)?.name ?? "your agent";

  useEffect(() => {
    box.current?.querySelector<HTMLElement>("button[data-request]")?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const onDown = (event: globalThis.PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  function send(request: string) {
    setError(null);
    startTransition(async () => {
      const result = await createHandOffAction({ agentId, itemType, itemId, request });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={`Hand off ${itemTitle}`}
      className="fixed z-50 w-[296px] rounded-xl border border-zk-border bg-zk-surface p-2 text-left shadow-xl"
      style={{ left: x, top: y }}
      data-handoff-menu
    >
      <p className="px-2 pb-1 pt-1 text-xs font-semibold text-zk-muted">
        Ask {agentName} about <span className="text-zk-text">{itemTitle}</span>
      </p>
      {agents.length === 0 ? (
        <p className="px-2 py-2 text-sm text-zk-text2">Connect an agent first (Agents menu → Connect your agent).</p>
      ) : (
        <>
          {agents.length > 1 ? (
            <label className="flex items-center gap-2 px-2 py-1 text-xs text-zk-text2">
              Agent
              <select
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                className="flex-1 rounded-lg border border-zk-border bg-zk-bg px-2 py-1 text-xs text-zk-text"
              >
                {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
            </label>
          ) : null}
          <ul className="mt-1 space-y-0.5">
            {requests.map((request) => (
              <li key={request}>
                <button
                  type="button"
                  data-request
                  disabled={pending}
                  onClick={() => send(request)}
                  className="w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-zk-text hover:bg-zk-tint focus-visible:bg-zk-tint focus-visible:outline-none disabled:opacity-50"
                >
                  {request}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {pending ? <p className="px-2 py-1 text-xs text-zk-muted">Handing it to {agentName}…</p> : null}
      {error ? <p role="alert" className="px-2 py-1 text-xs text-zk-bad-fg">{error}</p> : null}
    </div>
  );
}
