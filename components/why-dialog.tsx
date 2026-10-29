"use client";

import { useState } from "react";
import { getActionDetails, createChallengeAction } from "@/app/(app)/activity/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type WhyDialogProps = {
  actionType: "validation" | "bid" | "test_verdict" | "claim_release";
  actionId: string;
  agentId: string;
  bugId: string;
  children: React.ReactNode;
};

export function WhyDialog({
  actionType,
  actionId,
  agentId,
  bugId,
  children,
}: WhyDialogProps) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<{ why: string | null; whatIchecked: string | null; label: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [disagreeReason, setDisagreeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  async function loadDetails() {
    setLoading(true);
    setError(null);
    try {
      const d = await getActionDetails({ actionType, actionId });
      setDetails(d ?? { why: null, whatIchecked: null, label: actionType });
    } catch {
      setError("Could not load the agent's explanation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisagree() {
    if (!disagreeReason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createChallengeAction({
        agentId,
        bugId,
        actionType,
        actionId,
        reason: disagreeReason.trim(),
      });
      setOpen(false);
      setDisagreeReason("");
    } catch {
      setError("Could not send the challenge. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <button
          onClick={() => {
            setAcknowledged(false);
            loadDetails();
            setOpen(true);
          }}
          className="text-xs text-zk-muted hover:text-zk-accent underline-offset-2 hover:underline"
          aria-label="Why did the agent do this?"
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why I did this</DialogTitle>
          <DialogDescription>
            {details?.label ?? actionType} · agent action
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-zk-muted">Loading…</p>
        ) : error ? (
          <p className="text-sm text-zk-bad-fg">{error}</p>
        ) : details ? (
          <>
            {details.why ? (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-zk-text2 uppercase tracking-wider mb-1">Why I did this</h3>
                <p className="text-sm text-zk-text whitespace-pre-wrap break-words">{details.why}</p>
              </div>
            ) : null}
            {details.whatIchecked ? (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-zk-text2 uppercase tracking-wider mb-1">What I checked</h3>
                <p className="text-sm text-zk-text whitespace-pre-wrap break-words">{details.whatIchecked}</p>
              </div>
            ) : (
              <p className="text-xs text-zk-muted mb-4">No explanation recorded for this action.</p>
            )}
            {!acknowledged && (
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAcknowledged(true);
                  }}
                >
                  Makes sense
                </Button>
              </div>
            )}
            <div>
              <h3 className="text-xs font-semibold text-zk-text2 uppercase tracking-wider mb-1">I disagree</h3>
              <p className="text-xs text-zk-text2 mb-2">Tell the agent what it got wrong.</p>
              <Input
                value={disagreeReason}
                onChange={(e) => setDisagreeReason(e.target.value)}
                placeholder="What should the agent have done instead?"
                disabled={submitting}
              />
              <Button
                onClick={handleDisagree}
                disabled={submitting || !disagreeReason.trim()}
                className="mt-2"
              >
                {submitting ? "Sending…" : "Send challenge"}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
