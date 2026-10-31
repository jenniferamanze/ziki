import { AgentAvatar } from "@/components/agent-avatar";

/**
 * "<agent> is on it" on an item handed to an agent: the agent's own robot,
 * with a slowly blinking light while it works. Its latest note on hover.
 */
export function HandOffLabel({ agentId, agentName, note }: { agentId: string; agentName: string; note: string }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zk-border bg-zk-tint py-0.5 pr-2 pl-0.5 text-[11px] font-bold text-zk-accent"
      title={note}
    >
      <span className="relative inline-flex">
        <AgentAvatar agentId={agentId} size={18} />
        <span className="zr-blink absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
      </span>
      <span className="truncate">{agentName} is on it</span>
    </span>
  );
}
