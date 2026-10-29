"use client";

import { useCallback, useState } from "react";
import { createHandOffAction } from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { useAgentList } from "@/hooks/use-agent-list";

type HandOffMenuProps = {
  open: boolean;
  x: number;
  y: number;
  itemType: "points" | "assigned_issue";
  itemId: string;
  itemTitle: string;
  presetActions: string[];
  onClose: () => void;
};

export function HandOffMenu({
  open,
  x,
  y,
  itemType,
  itemId,
  itemTitle,
  presetActions,
  onClose,
}: HandOffMenuProps) {
  const { agents, loading } = useAgentList();
  const [agentId, setAgentId] = useState<string | null>(agents.length ? agents[0].id : null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectAction = useCallback(
    async (request: string) => {
      if (!agentId) return;
      setSubmitting(true);
      setError(null);
      try {
        await createHandOffAction({
          agentId,
          itemType,
          itemId,
          itemTitle,
          request,
        });
      } catch {
        setError("Could not create hand-off. Try again.");
      } finally {
        setSubmitting(false);
        onClose();
      }
    },
    [agentId, itemType, itemId, itemTitle, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed z-50 w-72 rounded-xl border border-zk-border bg-zk-surface shadow-xl p-2"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-2 border-b border-zk-divider">
        <p className="text-xs font-semibold text-zk-text2">Hand off to agent</p>
        {loading ? (
          <p className="mt-1 text-xs text-zk-muted">Loading agents…</p>
        ) : agents.length === 0 ? (
          <p className="mt-1 text-xs text-zk-muted">No agents. Pair one at /settings/agents/pair.</p>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-zk-text2">Agent:</span>
            <select
              value={agentId ?? ""}
              onChange={(e) => setAgentId(e.target.value || null)}
              className="flex-1 rounded-lg border border-zk-border bg-zk-bg px-2.5 py-1.5 text-xs text-zk-text focus-visible:ring-2 focus-visible:ring-electric-blue"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.model})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="text-xs font-semibold text-zk-text2 mb-2">What should the agent do?</p>
        {!agentId ? null : (
          <div className="space-y-1.5">
            {presetActions.map((request, i) => (
              <Button
                key={i}
                variant="ghost"
                onClick={() => selectAction(request)}
                disabled={submitting}
                className="w-full justify-start text-left text-sm"
              >
                {submitting ? "Sending…" : request}
              </Button>
            ))}
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full justify-start text-left text-xs text-zk-muted"
            >
              Cancel
            </Button>
          </div>
        )}
        {error && (
          <p className="mt-2 text-xs text-zk-bad-fg">{error}</p>
        )}
      </div>
    </div>
  );
}
