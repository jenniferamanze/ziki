"use client";

import { useSyncExternalStore } from "react";

const KEY = "ziki:handoff-tip-dismissed";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** One-time tip for "Point and hand off", until the person clicks Got it. */
export function HandOffTip({ hasAgents }: { hasAgents: boolean }) {
  // On the server (and first paint) the tip is hidden, so nothing flashes.
  const dismissed = useSyncExternalStore(subscribe, read, () => true);
  if (dismissed || !hasAgents) return null;
  return (
    <div role="note" className="flex flex-wrap items-center gap-3 rounded-xl border border-zk-border bg-zk-tint px-4 py-2.5 text-sm text-zk-text">
      <span aria-hidden="true">👉</span>
      <span className="flex-1">
        <strong>Tip:</strong> hold <kbd className="rounded border border-zk-border bg-zk-surface px-1 font-mono text-xs">Alt</kbd> (Option on a Mac) and click a card or an issue below, or long-press it on a phone, to hand it to your agent.
      </span>
      <button
        type="button"
        className="rounded-full bg-electric-blue-strong px-3 py-1 text-xs font-semibold text-white"
        onClick={() => {
          try {
            window.localStorage.setItem(KEY, "1");
          } catch {
            // Private mode: the tip just shows again next time.
          }
          listeners.forEach((listener) => listener());
        }}
      >
        Got it
      </button>
    </div>
  );
}
