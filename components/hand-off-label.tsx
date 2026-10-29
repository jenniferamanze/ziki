"use client";

export function HandOffLabel({ progressNote }: { progressNote?: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-zk-border bg-zk-tint px-2.5 py-0.5 text-xs font-bold text-zk-text"
      title={progressNote ?? "Agent is working on this"}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-zk-warn-fg" aria-hidden="true" />
      Claude is on it
      {progressNote ? (
        <span className="ml-1 text-[10px] text-zk-muted">— {progressNote}</span>
      ) : null}
    </span>
  );
}
