/** "<agent> is on it" on an item handed to an agent; the latest note on hover. */
export function HandOffLabel({ agentName, note }: { agentName: string; note: string }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zk-border bg-zk-tint px-2 py-0.5 text-[11px] font-bold text-zk-accent"
      title={note}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zk-accent motion-safe:animate-pulse" aria-hidden="true" />
      <span className="truncate">{agentName} is on it</span>
    </span>
  );
}
